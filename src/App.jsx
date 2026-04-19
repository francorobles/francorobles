import React, { useMemo, useState } from "react";

const navItems = [
  { href: "#about-me", label: "About Me", icon: "icon-home" },
  { href: "#experience", label: "Experience", icon: "icon-eye" },
  { href: "#education", label: "Education", icon: "icon-briefcase" },
  { href: "#skills", label: "Skills", icon: "icon-graduation" },
  { href: "#portfolio", label: "Portfolio", icon: "icon-diamond" },
  { href: "#recommendations", label: "Recommendations", icon: "icon-pencil" },
  { href: "#blog", label: "Blog", icon: "icon-bubbles" },
  { href: "#say-hello", label: "Say Hello", icon: "icon-envelope-open" }
];

const emptyForm = {
  title: "",
  excerpt: "",
  body: "",
  category: "Journal",
  author: "Franco Robles"
};

const experiences = [
  {
    from: "Sep 2012",
    to: "Present",
    duration: "3 Years 9 Months",
    company: "Okler Themes",
    location: "Greater New York",
    role: "Chief Product Officer",
    copy: "Owns the product story from idea to release, shaping visual systems, editorial rhythm, and measurable launch outcomes."
  },
  {
    from: "Jan 2010",
    to: "Sep 2012",
    duration: "2 Years 8 Months",
    company: "Porto Studio",
    location: "Remote",
    role: "Front-End Developer",
    copy: "Built responsive experiences with a focus on fast rendering, accessible layouts, and reusable interface patterns."
  },
  {
    from: "Jun 2008",
    to: "Dec 2009",
    duration: "1 Year 6 Months",
    company: "Design Lab",
    location: "Manila",
    role: "UI Engineer",
    copy: "Translated brand systems into production pages, keeping typography, spacing, and interaction details aligned."
  }
];

const education = Array.from({ length: 6 }, (_, index) => ({
  school: "Porto University",
  course: index % 2 === 0 ? "Master of Information Technology" : "Digital Product Design",
  years: index % 2 === 0 ? "2001-2025" : "1998-2001"
}));

const skillGroups = [
  [
    ["Start Up", 60],
    ["Innovation", 80],
    ["Products", 70],
    ["CSS", 90]
  ],
  [
    ["Javascript", 60],
    ["Business", 80],
    ["E-commerce", 70],
    ["Creative", 90]
  ]
];

const portfolio = Array.from({ length: 8 }, (_, index) => ({
  image: `/assets/resume/portfolio-${index + 1}.jpg`,
  type: ["websites", "logos", "brands", "websites"][index % 4]
}));

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function FloatingNav() {
  return (
    <header id="header" className="header-floating-icons" aria-label="Primary">
      <div className="header-body">
        <nav className="wrapper-spy">
          <ul className="nav" id="mainNav">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="nav-link text-color-dark bg-color-primary">
                  <i className={`${item.icon} icons`} aria-hidden="true" />
                  <span className="custom-tooltip text-color-dark">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Composer({ onCreate }) {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: "saving", message: "Publishing draft..." });

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "The post could not be saved.");
      }

      onCreate(payload);
      setForm(emptyForm);
      setStatus({ type: "success", message: "Post published." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <form className="blog-composer custom-box-shadow-1" onSubmit={handleSubmit}>
      <div>
        <p className="section-kicker">Create Blog</p>
        <h3>Publish a Post</h3>
      </div>
      <div className="form-grid">
        <label className="form-control-custom">
          <input name="title" value={form.title} onChange={updateField} placeholder="Title *" required />
        </label>
        <label className="form-control-custom">
          <input name="excerpt" value={form.excerpt} onChange={updateField} placeholder="Excerpt *" required />
        </label>
        <label className="form-control-custom">
          <input name="category" value={form.category} onChange={updateField} placeholder="Category" />
        </label>
        <label className="form-control-custom">
          <input name="author" value={form.author} onChange={updateField} placeholder="Author" />
        </label>
      </div>
      <label className="form-control-custom">
        <textarea name="body" value={form.body} onChange={updateField} placeholder="Post Body *" required />
      </label>
      <div className="composer-actions">
        <button className="btn btn-primary btn-outline custom-btn-style-2" type="submit" disabled={status.type === "saving"}>
          {status.type === "saving" ? "Publishing" : "Publish Post"}
        </button>
        <span className={`form-status form-status-${status.type}`}>{status.message}</span>
      </div>
    </form>
  );
}

function BlogCard({ post }) {
  return (
    <article className="thumb-info custom-thumb-info-2 custom-box-shadow-1">
      <div className="thumb-info-wrapper">
        <a href={`#${post.id}`}>
          <img src={post.image} alt="" className="img-fluid" />
        </a>
      </div>
      <div className="thumb-info-caption">
        <div className="thumb-info-caption-text">
          <h4>
            <a id={post.id} href={`#${post.id}`} className="text-decoration-none text-color-light font-weight-semibold">
              {post.title}
            </a>
          </h4>
          <p className="custom-text-color-2">{post.excerpt}</p>
        </div>
        <hr className="solid" />
        <div className="blog-card-footer">
          <div className="custom-blog-post-date text-uppercase font-weight-semibold text-color-light text-2">
            {formatDate(post.createdAt)}
          </div>
          <div className="custom-blog-post-share text-uppercase font-weight-semibold text-color-light text-2">
            Share:
            <ul>
              <li><a className="item-facebook" href="#blog">Facebook</a></li>
              <li><a className="item-twitter" href="#blog">Twitter</a></li>
              <li><a className="item-google-plus" href="#blog">Google Plus</a></li>
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

function App({ initialPosts = [] }) {
  const [posts, setPosts] = useState(initialPosts);
  const visiblePosts = useMemo(() => posts.slice(0, 2), [posts]);

  function addPost(post) {
    setPosts((current) => [post, ...current]);
    window.requestAnimationFrame(() => {
      document.getElementById("blog")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <>
      <FloatingNav />
      <main className="main">
        <div id="about-me">
          <section className="section about-hero custom-section-padding-1 custom-position-1">
            <div className="container">
              <div className="about-hero-grid">
                <div className="profile-column">
                  <img src="/assets/resume/me.jpg" className="custom-border custom-image-position-2 custom-box-shadow-4" alt="Profile portrait" />
                </div>
                <div className="intro-column">
                  <h1 className="text-color-primary custom-font-size-1">Franco Robles</h1>
                  <p className="text-color-light custom-font-size-2 custom-margin-bottom-1">React SSR Blog Creator</p>
                  <span className="custom-about-me-infos">
                    <span className="custom-text-color-1 text-uppercase">Greater Manila area</span>
                    <span className="custom-text-color-1 text-uppercase">Information Technology &amp; Services</span>
                    <span className="custom-text-color-1 text-uppercase">
                      <strong className="text-color-light">Previous: </strong>
                      Front-End Developer at Porto
                      <a href="#experience" className="btn btn-tertiary custom-btn-style-1">View More</a>
                    </span>
                    <span className="custom-text-color-1 text-uppercase">
                      <strong className="text-color-light">Education: </strong>
                      Porto School
                      <a href="#education" className="btn btn-tertiary custom-btn-style-1">View More</a>
                    </span>
                  </span>
                </div>
                <div className="mouse-column">
                  <img src="/assets/resume/mouse.png" className="custom-image-pos-1" alt="" />
                </div>
              </div>
            </div>
            <ul className="social-icons custom-social-icons">
              <li className="social-icons-facebook"><a href="#about-me" title="Facebook"><i className="fab fa-facebook-f" /></a></li>
              <li className="social-icons-x"><a href="#about-me" title="X"><i className="fab fa-x-twitter" /></a></li>
              <li className="social-icons-youtube"><a href="#about-me" title="Youtube"><i className="fab fa-youtube" /></a></li>
            </ul>
          </section>

          <div className="custom-about-me-links bg-color-dark">
            <div className="container about-link-grid">
              <a href="#say-hello" className="custom-nav-button text-color-light">
                <i className="icon-earphones-alt icons text-color-primary" />
                Contact Information
              </a>
              <a href="#say-hello" className="custom-nav-button custom-divisors text-color-light">
                <i className="icon-envelope-open icons text-color-primary" />
                Send Message
              </a>
              <a href="#blog" className="custom-nav-button text-color-light">
                <i className="icon-cloud-download icons text-color-primary" />
                Create Blog
              </a>
            </div>
          </div>

          <section className="section bg-color-dark">
            <div className="container about-copy">
              <aside className="custom-box-details bg-color-darken custom-box-shadow-1">
                <h4>Personal Details</h4>
                <div className="details-grid">
                  <ul className="custom-list-style-1">
                    <li><span className="text-color-light">Birthday:</span><span className="custom-text-color-2">1990 October 2</span></li>
                    <li><span className="text-color-light">Marital:</span><span className="custom-text-color-2">Single</span></li>
                    <li><span className="text-color-light">Nationality:</span><span className="custom-text-color-2">American</span></li>
                  </ul>
                  <ul className="custom-list-style-1">
                    <li><span className="text-color-light">Skype:</span><span className="custom-text-color-2">yourskype</span></li>
                    <li><span className="text-color-light">Phone:</span><span className="custom-text-color-2">123-456-789</span></li>
                    <li><span className="text-color-light">Email:</span><span className="custom-text-color-2">me@domain.com</span></li>
                  </ul>
                </div>
              </aside>
              <h2 className="text-color-light font-weight-extra-bold text-uppercase">About Me</h2>
              <p>
                Donec id elit non mi porta gravida at eget metus. Fusce dapibus, tellus ac cursus commodo,
                tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus.
              </p>
              <p>
                This React version keeps the Porto resume-dark visual structure while adding an SSR-backed blog
                composer, hydrated client interactions, and JSON persistence for new posts.
              </p>
              <a className="btn btn-tertiary custom-btn-style-1" href="#blog">View More</a>
            </div>
          </section>
        </div>

        <section id="experience" className="section section-secondary">
          <div className="container">
            <h2 className="text-color-light text-uppercase font-weight-extra-bold">Experience</h2>
            <section className="timeline custom-timeline">
              <div className="timeline-body">
                {experiences.map((item) => (
                  <article className="timeline-box right custom-box-shadow-2" key={item.role + item.from}>
                    <div className="timeline-row">
                      <div className="experience-info bg-color-primary">
                        <span className="from text-color-light text-uppercase">From<span>{item.from}</span></span>
                        <span className="to text-color-light text-uppercase">To<span>{item.to}</span></span>
                        <p className="text-color-light">({item.duration})</p>
                        <span className="company text-color-light font-weight-semibold">{item.company}<span>{item.location}</span></span>
                      </div>
                      <div className="experience-description bg-color-dark">
                        <h4 className="text-color-light font-weight-semibold">{item.role}</h4>
                        <p className="custom-text-color-2">{item.copy}</p>
                      </div>
                    </div>
                  </article>
                ))}
                <div className="timeline-bar" />
              </div>
            </section>
          </div>
        </section>

        <section id="education" className="section bg-color-dark">
          <div className="container">
            <h2 className="text-color-quaternary text-uppercase font-weight-extra-bold">Education</h2>
            <div className="education-grid">
              {education.map((item, index) => (
                <div className="custom-box-details-2 bg-color-darken custom-box-shadow-3" key={`${item.course}-${index}`}>
                  <i className="icon-graduation icons text-color-primary" />
                  <h4 className="text-color-light">{item.school}</h4>
                  <p className="custom-text-color-2">{item.course}</p>
                  <strong className="text-color-primary">{item.years}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="skills" className="section bg-color-dark">
          <div className="container skills-grid">
            <div>
              <h2 className="text-color-light text-uppercase font-weight-extra-bold">Skills &amp; Language</h2>
              <div className="skill-columns">
                {skillGroups.map((group, index) => (
                  <div className="progress-bars custom-progress-bars" key={index}>
                    {group.map(([label, value]) => (
                      <div className="progress-item" key={label}>
                        <div className="progress-label text-color-light font-weight-semibold text-uppercase text-2">
                          <span>{label}</span>
                        </div>
                        <div className="progress"><div className="progress-bar" style={{ width: `${value}%` }} /></div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <aside className="custom-box-details bg-color-darken custom-box-shadow-1">
              <h4 className="text-color-light">Languages</h4>
              <ul className="custom-list-style-1">
                <li><span className="text-color-light custom-max-width-1">English:</span><span className="custom-text-color-2">Advanced</span></li>
                <li><span className="text-color-light custom-max-width-1">Spanish:</span><span className="custom-text-color-2">Advanced</span></li>
                <li><span className="text-color-light custom-max-width-1">French:</span><span className="custom-text-color-2">Basic</span></li>
              </ul>
            </aside>
          </div>
        </section>

        <section id="portfolio" className="section bg-color-secondary">
          <div className="container">
            <h2 className="text-color-light font-weight-extra-bold text-uppercase">Portfolio</h2>
            <ul className="nav custom-nav-sort">
              <li className="active"><a href="#portfolio">Show All</a></li>
              <li><a href="#portfolio">Websites</a></li>
              <li><a href="#portfolio">Logos</a></li>
              <li><a href="#portfolio">Brands</a></li>
            </ul>
            <div className="portfolio-grid">
              {portfolio.map((item, index) => (
                <a className={`custom-thumb-info-1 ${item.type}`} href={item.image} key={item.image}>
                  <span className="thumb-info-wrapper">
                    <span className="thumb-info-plus" />
                    <img src={item.image} alt={`Portfolio ${index + 1}`} />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="recommendations" className="section bg-color-primary recommendations">
          <div className="container">
            <h2 className="text-color-light font-weight-extra-bold text-uppercase">Recommendations</h2>
            <blockquote className="custom-testimonial-style-1">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam tincidunt nulla tortor,
                a imperdiet enim tristique nec. Nulla lobortis leo eget metus dapibus sodales.
              </p>
              <footer><strong>Bob Doe</strong><span>Director of Engineering</span></footer>
            </blockquote>
          </div>
        </section>

        <section id="blog" className="section bg-color-dark">
          <div className="container">
            <h2 className="text-color-quaternary font-weight-extra-bold text-uppercase">My Blog</h2>
            <Composer onCreate={addPost} />
            <div className="blog-grid">
              {visiblePosts.map((post) => <BlogCard key={post.id} post={post} />)}
            </div>
            <div className="view-all-row">
              <a className="btn btn-primary btn-outline custom-btn-style-2" href="#blog">View All</a>
            </div>
          </div>
        </section>

        <section id="say-hello" className="say-hello">
          <div className="hello-form bg-color-primary">
            <div className="half-inner">
              <h2 className="text-color-light text-uppercase font-weight-extra-bold">Say Hello</h2>
              <form className="contact-form custom-form-style">
                <label className="form-control-custom form-control-custom-light"><input placeholder="Your Name *" /></label>
                <label className="form-control-custom form-control-custom-light"><input placeholder="Subject *" /></label>
                <label className="form-control-custom form-control-custom-light"><input placeholder="Email Address *" /></label>
                <label className="form-control-custom form-control-custom-light"><textarea placeholder="Message *" /></label>
                <button className="btn btn-tertiary custom-btn-style-1" type="button">Submit</button>
              </form>
            </div>
          </div>
          <div className="hello-info">
            <div className="half-inner">
              <h2 className="text-color-light text-uppercase font-weight-extra-bold">Contact Information</h2>
              <div className="feature-list">
                <div className="custom-feature-box">
                  <span className="custom-feature-box-icon"><i className="icon-location-pin icons" /></span>
                  <span><small>Address</small><strong>Greater Manila Area</strong></span>
                </div>
                <div className="custom-feature-box">
                  <span className="custom-feature-box-icon"><i className="icon-phone icons" /></span>
                  <span><small>Phone</small><strong>123-456-789</strong></span>
                </div>
                <div className="custom-feature-box">
                  <span className="custom-feature-box-icon"><i className="icon-envelope icons" /></span>
                  <span><small>Email</small><strong>me@domain.com</strong></span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
