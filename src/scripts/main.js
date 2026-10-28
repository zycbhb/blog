(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("rain");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, drops = [], raf = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.min(150, Math.floor(w / 9));
      drops = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        len: 8 + Math.random() * 26,
        speed: 0.6 + Math.random() * 1.8,
        alpha: 0.08 + Math.random() * 0.28
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (const d of drops) {
        ctx.strokeStyle = `rgba(120, 226, 214, ${d.alpha})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1, d.y + d.len);
        ctx.stroke();
        d.y += d.speed * 5;
        d.x -= 0.3;
        if (d.y > h + 30) {
          d.y = -30;
          d.x = Math.random() * w;
        }
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        ctx.strokeStyle = `rgba(120, 226, 214, ${d.alpha * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1, d.y + d.len);
        ctx.stroke();
      }
    } else {
      draw();
    }
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        raf = requestAnimationFrame(draw);
      }
    });
  }

  const pupil = document.getElementById("pupil");
  if (pupil && !reduce && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      const rect = pupil.ownerSVGElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width * 0.9)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height * 0.9)));
      pupil.style.transform = `translate(${dx * 11}px, ${dy * 9}px)`;
    }, { passive: true });
  }

  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      reveals.forEach((el) => io.observe(el));
    }
  }

  const bar = document.getElementById("progress");
  if (bar) {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = max > 0 ? `${(window.scrollY / max) * 100}%` : "0%";
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }
})();
