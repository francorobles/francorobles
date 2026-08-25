#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FUNCTION_NAME="portfolio-contact-form"
REGION="us-east-1"
RUNTIME="nodejs22.x"
HANDLER="index.handler"
MEMORY=128
TIMEOUT=10

S3_BUCKET="francorobles.com"

ROLE_NAME="portfolio-lambda-role"

# Throttling — requests per second (rate) and max burst per stage
THROTTLE_RATE=2
THROTTLE_BURST=5
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(dirname "$SCRIPT_DIR")"
LAMBDA_DIR="$SCRIPT_DIR/contact-form"
ZIP_FILE="$SCRIPT_DIR/contact-form.zip"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
check_deps() {
  for cmd in aws zip openssl; do
    command -v "$cmd" &>/dev/null || { echo "ERROR: '$cmd' is not installed."; exit 1; }
  done
}

generate_captcha_secret() {
  openssl rand -hex 32
}

get_captcha_secret() {
  local secret="${CAPTCHA_SECRET:-}"

  if [[ -n "$secret" ]]; then
    echo "$secret"
    return
  fi

  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    secret=$(aws lambda get-function-configuration \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION" \
      --query "Environment.Variables.CAPTCHA_SECRET" \
      --output text 2>/dev/null || true)

    if [[ -n "$secret" && "$secret" != "None" ]]; then
      echo "$secret"
      return
    fi
  fi

  generate_captcha_secret
}

get_account_id() {
  aws sts get-caller-identity --query Account --output text
}

ensure_role() {
  local account_id="$1"
  local role_arn="arn:aws:iam::${account_id}:role/${ROLE_NAME}"

  if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
    echo "IAM role already exists: $role_arn" >&2
  else
    echo "Creating IAM role: $ROLE_NAME ..." >&2
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document '{
        "Version":"2012-10-17",
        "Statement":[{
          "Effect":"Allow",
          "Principal":{"Service":"lambda.amazonaws.com"},
          "Action":"sts:AssumeRole"
        }]
      }' > /dev/null

    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    echo "Waiting for role to propagate..." >&2
    sleep 10
  fi

  # Ensure SES send permission is attached (idempotent)
  local ses_policy_name="portfolio-lambda-ses"
  if ! aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$ses_policy_name" &>/dev/null; then
    echo "Attaching SES send permission to role..." >&2
    aws iam put-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-name "$ses_policy_name" \
      --policy-document '{
        "Version":"2012-10-17",
        "Statement":[{
          "Effect":"Allow",
          "Action":"ses:SendEmail",
          "Resource":"*"
        }]
      }'
  fi

  echo "$role_arn"
}

package_lambda() {
  echo "Packaging Lambda..."
  rm -f "$ZIP_FILE"
  (cd "$LAMBDA_DIR" && zip -q "$ZIP_FILE" index.js)
  echo "Package: $ZIP_FILE"
}

deploy_lambda() {
  local role_arn="$1"
  local captcha_secret="$2"

  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    echo "Updating Lambda function code..."
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://$ZIP_FILE" \
      --region "$REGION" > /dev/null

    echo "Waiting for update to complete..."
    aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION"

    echo "Updating Lambda environment variables..."
    aws lambda update-function-configuration \
      --function-name "$FUNCTION_NAME" \
      --environment "Variables={CAPTCHA_SECRET=${captcha_secret}}" \
      --region "$REGION" > /dev/null
  else
    echo "Creating Lambda function..."
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime "$RUNTIME" \
      --role "$role_arn" \
      --handler "$HANDLER" \
      --zip-file "fileb://$ZIP_FILE" \
      --memory-size "$MEMORY" \
      --timeout "$TIMEOUT" \
      --environment "Variables={CAPTCHA_SECRET=${captcha_secret}}" \
      --region "$REGION" > /dev/null

    echo "Waiting for Lambda to be active..."
    aws lambda wait function-active \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION"
  fi

  echo "Lambda deployed: $FUNCTION_NAME"
}

ensure_api_gateway() {
  local account_id="$1"
  local api_id api_url

  api_id=$(aws apigatewayv2 get-apis \
    --region "$REGION" \
    --query "Items[?Name=='${FUNCTION_NAME}-api'].ApiId" \
    --output text)

  if [[ -z "$api_id" || "$api_id" == "None" ]]; then
    echo "Creating API Gateway HTTP API..." >&2
    api_id=$(aws apigatewayv2 create-api \
      --name "${FUNCTION_NAME}-api" \
      --protocol-type HTTP \
      --cors-configuration \
        AllowOrigins='["https://francorobles.com"]',AllowMethods='["GET","POST","OPTIONS"]',AllowHeaders='["Content-Type"]' \
      --region "$REGION" \
      --query ApiId \
      --output text)
    echo "API Gateway created: $api_id" >&2

    local lambda_arn="arn:aws:lambda:${REGION}:${account_id}:function:${FUNCTION_NAME}"

    echo "Creating Lambda integration..." >&2
    local integration_id
    integration_id=$(aws apigatewayv2 create-integration \
      --api-id "$api_id" \
      --integration-type AWS_PROXY \
      --integration-uri "$lambda_arn" \
      --payload-format-version 2.0 \
      --region "$REGION" \
      --query IntegrationId \
      --output text)

    echo "Creating POST route..." >&2
    aws apigatewayv2 create-route \
      --api-id "$api_id" \
      --route-key "POST /contact" \
      --target "integrations/${integration_id}" \
      --region "$REGION" > /dev/null

    echo "Creating GET route..." >&2
    aws apigatewayv2 create-route \
      --api-id "$api_id" \
      --route-key "GET /contact" \
      --target "integrations/${integration_id}" \
      --region "$REGION" > /dev/null

    echo "Creating default stage with throttling and auto-deploy..." >&2
    aws apigatewayv2 create-stage \
      --api-id "$api_id" \
      --stage-name '$default' \
      --auto-deploy \
      --default-route-settings \
        "ThrottlingRateLimit=${THROTTLE_RATE},ThrottlingBurstLimit=${THROTTLE_BURST}" \
      --region "$REGION" > /dev/null

    echo "Granting API Gateway permission to invoke Lambda..." >&2
    aws lambda add-permission \
      --function-name "$FUNCTION_NAME" \
      --statement-id "apigateway-invoke-${api_id}" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:${account_id}:${api_id}/*/*/contact" \
      --region "$REGION" > /dev/null
  else
    echo "API Gateway already exists: $api_id — updating CORS and throttling..." >&2
    aws apigatewayv2 update-api \
      --api-id "$api_id" \
      --cors-configuration \
        AllowOrigins='["https://francorobles.com"]',AllowMethods='["GET","POST","OPTIONS"]',AllowHeaders='["Content-Type"]' \
      --region "$REGION" > /dev/null

    local integration_id get_route_id post_route_id
    integration_id=$(aws apigatewayv2 get-integrations \
      --api-id "$api_id" \
      --region "$REGION" \
      --query "Items[0].IntegrationId" \
      --output text)

    get_route_id=$(aws apigatewayv2 get-routes \
      --api-id "$api_id" \
      --region "$REGION" \
      --query "Items[?RouteKey=='GET /contact'].RouteId" \
      --output text)

    post_route_id=$(aws apigatewayv2 get-routes \
      --api-id "$api_id" \
      --region "$REGION" \
      --query "Items[?RouteKey=='POST /contact'].RouteId" \
      --output text)

    if [[ -z "$post_route_id" || "$post_route_id" == "None" ]]; then
      echo "Creating missing POST route..." >&2
      aws apigatewayv2 create-route \
        --api-id "$api_id" \
        --route-key "POST /contact" \
        --target "integrations/${integration_id}" \
        --region "$REGION" > /dev/null
    fi

    if [[ -z "$get_route_id" || "$get_route_id" == "None" ]]; then
      echo "Creating missing GET route..." >&2
      aws apigatewayv2 create-route \
        --api-id "$api_id" \
        --route-key "GET /contact" \
        --target "integrations/${integration_id}" \
        --region "$REGION" > /dev/null
    fi

    aws apigatewayv2 update-stage \
      --api-id "$api_id" \
      --stage-name '$default' \
      --default-route-settings \
        "ThrottlingRateLimit=${THROTTLE_RATE},ThrottlingBurstLimit=${THROTTLE_BURST}" \
      --region "$REGION" > /dev/null
  fi

  api_url=$(aws apigatewayv2 get-api \
    --api-id "$api_id" \
    --region "$REGION" \
    --query ApiEndpoint \
    --output text)

  echo "${api_url}/contact"
}

patch_index_html() {
  local endpoint="$1"
  local index_html="$SITE_DIR/index.html"

  if grep -q "PASTE_YOUR_API_GATEWAY_URL_HERE" "$index_html"; then
    sed -i.bak "s|PASTE_YOUR_API_GATEWAY_URL_HERE|${endpoint}|g" "$index_html"
    rm -f "${index_html}.bak"
    echo "Patched index.html with: $endpoint"
  else
    echo "index.html already has an endpoint — skipping patch."
  fi
}

sync_s3() {
  echo "Syncing site to s3://${S3_BUCKET} ..."
  aws s3 sync "$SITE_DIR" "s3://${S3_BUCKET}" \
    --exclude ".git/*" \
    --exclude "lambda/*" \
    --exclude ".DS_Store" \
    --exclude "*.bak" \
    --delete \
    --region "$REGION"
  echo "S3 sync complete."

  # Invalidate CloudFront if a distribution fronts this bucket
  local cf_id
  cf_id=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Origins.Items[0].DomainName=='${S3_BUCKET}.s3.amazonaws.com'].Id" \
    --output text 2>/dev/null || true)

  if [[ -n "$cf_id" && "$cf_id" != "None" ]]; then
    echo "Invalidating CloudFront distribution: $cf_id ..."
    aws cloudfront create-invalidation \
      --distribution-id "$cf_id" \
      --paths "/*" > /dev/null
    echo "CloudFront invalidation submitted."
  fi
}

verify_ses_identity() {
  local email="hello@francorobles.com"
  local status
  status=$(aws sesv2 get-email-identity \
    --email-identity "$email" \
    --region "$REGION" \
    --query "VerifiedForSendingStatus" \
    --output text 2>/dev/null || echo "NOT_FOUND")

  if [[ "$status" == "True" ]]; then
    echo "SES: $email is verified."
  elif [[ "$status" == "False" ]]; then
    echo ""
    echo "WARNING: $email is registered in SES but not yet verified."
    echo "  Check your inbox for the AWS verification email and click the link."
  else
    echo ""
    echo "Requesting SES verification for $email ..."
    aws sesv2 create-email-identity \
      --email-identity "$email" \
      --region "$REGION" > /dev/null
    echo "  Verification email sent to $email — click the link before testing the form."
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
check_deps

echo "==> Fetching AWS account ID..."
ACCOUNT_ID="$(get_account_id)"
echo "    Account: $ACCOUNT_ID | Region: $REGION"

echo ""
echo "==> Ensuring IAM role..."
ROLE_ARN="$(ensure_role "$ACCOUNT_ID")"

echo ""
echo "==> Checking SES identity..."
verify_ses_identity

echo ""
echo "==> Packaging Lambda..."
package_lambda

echo ""
echo "==> Preparing captcha secret..."
CAPTCHA_SECRET_VALUE="$(get_captcha_secret)"

echo ""
echo "==> Deploying Lambda..."
deploy_lambda "$ROLE_ARN" "$CAPTCHA_SECRET_VALUE"

echo ""
echo "==> Setting up API Gateway..."
ENDPOINT="$(ensure_api_gateway "$ACCOUNT_ID")"

echo ""
echo "==> Patching index.html..."
patch_index_html "$ENDPOINT"

echo ""
echo "==> Syncing site to S3..."
sync_s3

echo ""
echo "=========================================="
echo "  Deployment complete!"
echo "  API Endpoint : $ENDPOINT"
echo "  S3 Bucket    : s3://$S3_BUCKET"
echo "=========================================="
echo ""
echo "Test the contact form:"
echo "  curl -X POST $ENDPOINT \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"Test\",\"email\":\"test@example.com\",\"subject\":\"Hello\",\"message\":\"Test message\"}'"
