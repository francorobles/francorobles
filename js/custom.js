(() => {
	const canvas = document.createElement('canvas');
	canvas.id = 'neural-background';
	canvas.setAttribute('aria-hidden', 'true');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	document.body.appendChild(canvas);
	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
	const { nodes, edges, weights } = neuralNetwork;
	let width, height, frame, previous = 0, angle = 0.6;
	function draw(time) {
		if (previous && !reducedMotion.matches) angle += Math.min(time - previous, 50) * 0.00006;
		previous = time;
		ctx.clearRect(0, 0, width, height);
		const radius = Math.min(width * 0.27, height * 0.38);
		const points = nodes.map(([x, y, z]) => {
			const rotatedX = x * Math.cos(angle) + z * Math.sin(angle);
			const rotatedZ = z * Math.cos(angle) - x * Math.sin(angle);
			const tiltedY = y * Math.cos(0.36) - rotatedZ * Math.sin(0.36);
			const depth = y * Math.sin(0.36) + rotatedZ * Math.cos(0.36);
			const scale = 3.4 / Math.max(1.85 - depth, 0.24);
			return [width * 0.67 + rotatedX * radius * scale,
				height * 0.5 + tiltedY * radius * scale, scale];
		});
		ctx.strokeStyle = 'rgba(73, 176, 239, 0.12)';
		ctx.lineWidth = 0.45;
		ctx.beginPath();
		edges.forEach(([a, b]) => {
			ctx.moveTo(points[a][0], points[a][1]);
			ctx.lineTo(points[b][0], points[b][1]);
		});
		ctx.stroke();
		points.forEach(([x, y, scale], index) => {
			ctx.fillStyle = `rgba(108, 206, 255, ${Math.min(0.7, 0.2 + weights[index] * 0.5)})`;
			ctx.beginPath();
			ctx.arc(x, y, (0.6 + weights[index]) * Math.min(2.4, Math.sqrt(scale)), 0, Math.PI * 2);
			ctx.fill();
		});
		if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(draw);
	}
	function restart() {
		cancelAnimationFrame(frame);
		previous = 0;
		width = innerWidth;
		height = innerHeight;
		const ratio = Math.min(devicePixelRatio || 1, 2);
		canvas.width = width * ratio;
		canvas.height = height * ratio;
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		draw(0);
	}
	addEventListener('resize', restart);
	reducedMotion.addEventListener('change', restart);
	document.addEventListener('visibilitychange', restart);
	restart();
})();
