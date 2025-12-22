export const CSS = {
  Transform: {
    toString(transform: any) {
      if (!transform) return '';
      const { x = 0, y = 0, scaleX = 1, scaleY = 1 } = transform;
      return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
    }
  }
};
