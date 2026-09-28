/* Ribbons background - lightweight canvas implementation
   Designed to work without bundlers or external libs.
   Usage: include <div class="ribbons-container" data-ribbons-enabled="true" data-colors="#ffffff,#8b5cf6" data-speed="0.5"></div>
*/
(function(){
  function createRibbons(container){
    const canvas = document.createElement('canvas');
    canvas.className = 'ribbons-canvas';
    const ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    let width=0, height=0, raf=0;
    const opts = {
      colors: (container.dataset.colors || '#ffffff').split(',').map(s=>s.trim()),
      speed: parseFloat(container.dataset.speed||'0.5'),
      baseThickness: parseFloat(container.dataset.baseThickness||'24'),
      maxSegments: parseInt(container.dataset.maxSegments||'60',10),
      enableFade: container.dataset.enableFade!=='false'
    };

    function resize(){
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(32, container.clientWidth);
      height = Math.max(32, container.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }

    const ribbons = [];
    function initRibbons(){
      ribbons.length = 0;
      const center = { x: width/2, y: height/2 };
      const count = Math.max(1, Math.floor(width / 220));
      for(let i=0;i<count;i++){
        const color = opts.colors[i % opts.colors.length] || '#fff';
        const amp = (Math.random()*0.6 + 0.6) * (height/12);
        const speed = opts.speed * (0.5 + Math.random());
        const thickness = opts.baseThickness * (0.6 + Math.random()*0.8);
        const offsetX = (i - count/2) * (width/(count*1.2));
        ribbons.push({color, amp, speed, thickness, offsetX, phase: Math.random()*Math.PI*2, points: []});
      }
      ribbons.forEach(r=>{
        r.points = [];
        const segments = opts.maxSegments;
        for(let s=0;s<segments;s++) r.points.push({x: center.x + r.offsetX, y: center.y});
      });
    }

    function draw(t){
      ctx.clearRect(0,0,width,height);
      const time = t * 0.001;
      ribbons.forEach((r, idx) => {
        // update points
        const pts = r.points;
        const headX = width/2 + r.offsetX + Math.sin(time * r.speed + r.phase) * r.amp;
        const headY = height/2 + Math.cos(time * r.speed*0.9 + r.phase*1.1) * (r.amp*0.3);
        pts.unshift({x: headX + Math.sin(idx + time*0.6)*10, y: headY + Math.cos(idx*1.3 + time*0.8)*8});
        if(pts.length > opts.maxSegments) pts.pop();

        // draw polyline with fading
        ctx.beginPath();
        for(let i=0;i<pts.length;i++){
          const p = pts[i];
          const x = p.x; const y = p.y + i*0.5;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        const grad = ctx.createLinearGradient(0,0,width,0);
        grad.addColorStop(0, hexToRgba(r.color, 0.18));
        grad.addColorStop(0.5, hexToRgba(r.color, 0.12));
        grad.addColorStop(1, hexToRgba(r.color, 0.05));
        ctx.strokeStyle = grad;
        ctx.lineWidth = r.thickness * 0.9;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.stroke();

        // fill a subtle band
        ctx.globalCompositeOperation = 'source-over';
        if(opts.enableFade){
          for(let j=0;j<pts.length-1;j++){
            const a = pts[j];
            const b = pts[j+1];
            const alpha = Math.pow(1 - j/pts.length, 1.6) * 0.18;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(b.x, b.y + r.thickness*0.2);
            ctx.lineTo(a.x, a.y + r.thickness*0.2);
            ctx.closePath();
            ctx.fillStyle = hexToRgba(r.color, alpha);
            ctx.fill();
          }
        }
      });
    }

    function loop(t){
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    function start(){
      cancelAnimationFrame(raf);
      resize();
      initRibbons();
      raf = requestAnimationFrame(loop);
    }

    function stop(){ cancelAnimationFrame(raf); }

    // helpers
    function hexToRgba(hex, a){
      if(!hex) return 'rgba(255,255,255,'+a+')';
      let h = hex.replace('#',''); if(h.length===3) h = h.split('').map(c=> c+c).join('');
      const bigint = parseInt(h,16); const r = (bigint>>16)&255; const g=(bigint>>8)&255; const b=bigint&255;
      return 'rgba('+r+','+g+','+b+','+a+')';
    }

    window.addEventListener('resize', ()=>{ resize(); initRibbons(); });
    start();

    return {start, stop, canvas};
  }

  // auto-init for containers on DOMContentLoaded
  function initAll(){
    document.querySelectorAll('.ribbons-container').forEach(c=>{
      const enabled = c.dataset.ribbonsEnabled !== 'false';
      if(!enabled) return;
      if(!c._ribbonsInstance) c._ribbonsInstance = createRibbons(c);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll); else initAll();
  // expose for dev/debug
  window.__Ribbons = { initAll };
})();
