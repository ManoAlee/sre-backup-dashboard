(function(){
  // Vanilla JS version of Squares component. Mount to a container element and animate canvas.
  class Squares {
    constructor(container, opts={}){
      this.container = container;
      this.opts = Object.assign({
        direction: 'right',
        speed: 1,
        borderColor: '#999',
        squareSize: 40,
        hoverFillColor: '#222'
      }, opts);
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'squares-canvas';
      this.canvas.setAttribute('aria-hidden','true');
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.requestId = null;
      this.numSquaresX = 0;
      this.numSquaresY = 0;
      this.gridOffset = {x:0,y:0};
      this.hoveredSquare = null;
      this.lineHeight = this.opts.squareSize;
      this.bound = {};
      this._init();
    }
    _init(){
      this.bound.resize = this.resize.bind(this);
      this.bound.mousemove = this.handleMouseMove.bind(this);
      this.bound.mouseleave = this.handleMouseLeave.bind(this);
      window.addEventListener('resize', this.bound.resize);
      this.canvas.addEventListener('mousemove', this.bound.mousemove);
      this.canvas.addEventListener('mouseleave', this.bound.mouseleave);
      this.resize();
      this.updateAnimation();
    }
    resize(){
      const cs = this.opts.squareSize;
      this.canvas.width = Math.max(1, Math.floor(this.canvas.offsetWidth));
      this.canvas.height = Math.max(1, Math.floor(this.canvas.offsetHeight));
      this.numSquaresX = Math.ceil(this.canvas.width / cs) + 1;
      this.numSquaresY = Math.ceil(this.canvas.height / cs) + 1;
    }
    drawGrid(){
      const ctx = this.ctx; const canvas = this.canvas; const squareSize = this.opts.squareSize;
      ctx.clearRect(0,0,canvas.width,canvas.height);

      const startX = Math.floor(this.gridOffset.x / squareSize) * squareSize;
      const startY = Math.floor(this.gridOffset.y / squareSize) * squareSize;

      for(let x=startX; x<canvas.width + squareSize; x+= squareSize){
        for(let y=startY; y<canvas.height + squareSize; y+= squareSize){
          const squareX = x - (this.gridOffset.x % squareSize);
          const squareY = y - (this.gridOffset.y % squareSize);

          if(this.hoveredSquare && Math.floor((x - startX) / squareSize) === this.hoveredSquare.x && Math.floor((y - startY) / squareSize) === this.hoveredSquare.y){
            ctx.fillStyle = this.opts.hoverFillColor;
            ctx.fillRect(squareX, squareY, squareSize, squareSize);
          }

          ctx.strokeStyle = this.opts.borderColor;
          ctx.strokeRect(squareX, squareY, squareSize, squareSize);
        }
      }

      // subtle radial gradient overlay
      const gradient = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0,
        canvas.width/2, canvas.height/2, Math.sqrt(canvas.width*canvas.width + canvas.height*canvas.height)/2
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    updateAnimation(){
      const effectiveSpeed = Math.max(this.opts.speed, 0.1);
      const s = this.opts.squareSize;
      switch(this.opts.direction){
        case 'right': this.gridOffset.x = (this.gridOffset.x - effectiveSpeed + s) % s; break;
        case 'left': this.gridOffset.x = (this.gridOffset.x + effectiveSpeed + s) % s; break;
        case 'up': this.gridOffset.y = (this.gridOffset.y + effectiveSpeed + s) % s; break;
        case 'down': this.gridOffset.y = (this.gridOffset.y - effectiveSpeed + s) % s; break;
        case 'diagonal':
          this.gridOffset.x = (this.gridOffset.x - effectiveSpeed + s) % s;
          this.gridOffset.y = (this.gridOffset.y - effectiveSpeed + s) % s;
          break;
      }
      this.drawGrid();
      this.requestId = requestAnimationFrame(()=> this.updateAnimation());
    }
    handleMouseMove(ev){
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = ev.clientX - rect.left; const mouseY = ev.clientY - rect.top;
      const s = this.opts.squareSize;
      const startX = Math.floor(this.gridOffset.x / s) * s;
      const startY = Math.floor(this.gridOffset.y / s) * s;
      const hoveredSquareX = Math.floor((mouseX + this.gridOffset.x - startX) / s);
      const hoveredSquareY = Math.floor((mouseY + this.gridOffset.y - startY) / s);
      if(!this.hoveredSquare || this.hoveredSquare.x !== hoveredSquareX || this.hoveredSquare.y !== hoveredSquareY){
        this.hoveredSquare = {x: hoveredSquareX, y: hoveredSquareY};
      }
    }
    handleMouseLeave(){ this.hoveredSquare = null; }
    destroy(){
      cancelAnimationFrame(this.requestId);
      window.removeEventListener('resize', this.bound.resize);
      this.canvas.removeEventListener('mousemove', this.bound.mousemove);
      this.canvas.removeEventListener('mouseleave', this.bound.mouseleave);
      try{ this.container.removeChild(this.canvas); }catch(e){}
    }
  }

  // auto-mount: find elements with class .squares-container
  function mountAll(){
    const els = document.querySelectorAll('.squares-container');
    const instances = [];
    els.forEach(el=>{
      const opts = {};
      if(el.dataset.direction) opts.direction = el.dataset.direction;
      if(el.dataset.speed) opts.speed = parseFloat(el.dataset.speed);
      if(el.dataset.squareSize) opts.squareSize = Number(el.dataset.squareSize);
      if(el.dataset.borderColor) opts.borderColor = el.dataset.borderColor;
      if(el.dataset.hoverFill) opts.hoverFillColor = el.dataset.hoverFill;
      const inst = new Squares(el, opts);
      instances.push(inst);
    });
    // expose for debugging
    window.__SquaresInstances = instances;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
})();
