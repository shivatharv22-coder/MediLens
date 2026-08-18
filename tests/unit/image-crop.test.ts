import { describe, expect, it } from 'vitest';
import { containedImageRect, toPixelCrop } from '@/utils/image';

/**
 * A crop drawn on the preview is applied to full-resolution pixels later, so
 * the two coordinate spaces have to agree exactly.
 *
 * The failure this guards against is silent: the overlay is drawn from the same
 * numbers the crop is stored in, so a wrong mapping still renders a rectangle
 * under the user's finger while cropping somewhere else entirely. The only
 * symptom is OCR finding no text, which reads as a bad photo rather than a bug.
 */

describe('containedImageRect', () => {
  it('fills the box when the aspect ratios match', () => {
    const rect = containedImageRect({ width: 800, height: 600 }, 1200, 900);
    expect(rect).toEqual({ left: 0, top: 0, width: 800, height: 600 });
  });

  it('letterboxes horizontally for a portrait image in a wide box', () => {
    // The reported case: a phone photo on a desktop card, where `max-h-[60vh]`
    // clamps the element far shorter than the image's aspect ratio wants.
    const rect = containedImageRect({ width: 800, height: 480 }, 1200, 1600);
    expect(rect.width).toBeCloseTo(360);
    expect(rect.height).toBeCloseTo(480);
    // 220px of dead space on each side - 27.5% of the element per side.
    expect(rect.left).toBeCloseTo(220);
    expect(rect.top).toBeCloseTo(0);
  });

  it('letterboxes vertically for a landscape image in a tall box', () => {
    const rect = containedImageRect({ width: 400, height: 600 }, 1200, 600);
    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(200);
    expect(rect.left).toBeCloseTo(0);
    expect(rect.top).toBeCloseTo(200);
  });

  it('stays defined before the image has loaded', () => {
    // naturalWidth/Height are 0 until decode; this must not produce NaN.
    const rect = containedImageRect({ width: 800, height: 480 }, 0, 0);
    expect(rect).toEqual({ left: 0, top: 0, width: 800, height: 480 });
    expect(Number.isNaN(rect.left)).toBe(false);
  });

  it('stays defined for a zero-sized element', () => {
    const rect = containedImageRect({ width: 0, height: 0 }, 1200, 1600);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });
});

describe('crop mapping through a letterboxed preview', () => {
  const ELEMENT = { width: 800, height: 480 };
  const IMAGE = { width: 1200, height: 1600 };

  /** Pointer position on the picture, expressed as element-box client offsets. */
  function pointerAt(imageFractionX: number, imageFractionY: number) {
    const content = containedImageRect(ELEMENT, IMAGE.width, IMAGE.height);
    return {
      clientX: content.left + imageFractionX * content.width,
      clientY: content.top + imageFractionY * content.height,
    };
  }

  /** The fix: measure against the picture, not the element. */
  function fractionFromPointer(p: { clientX: number; clientY: number }) {
    const content = containedImageRect(ELEMENT, IMAGE.width, IMAGE.height);
    return {
      x: (p.clientX - content.left) / content.width,
      y: (p.clientY - content.top) / content.height,
    };
  }

  it('round-trips a pointer on the picture back to the same fraction', () => {
    const round = fractionFromPointer(pointerAt(0.03, 0.22));
    expect(round.x).toBeCloseTo(0.03);
    expect(round.y).toBeCloseTo(0.22);
  });

  it('maps a drawn box onto the pixels the user actually framed', () => {
    const start = fractionFromPointer(pointerAt(0.03, 0.22));
    const end = fractionFromPointer(pointerAt(0.83, 0.55));

    const px = toPixelCrop(
      { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y },
      IMAGE.width,
      IMAGE.height,
    );

    expect(px).toEqual({ x: 36, y: 352, width: 960, height: 528 });
  });

  it('the old element-relative maths cropped a much narrower strip', () => {
    // Regression guard, documenting why this is measured against the picture.
    // Reading the same pointer as a fraction of the ELEMENT loses the bars.
    const p = pointerAt(0.03, 0.22);
    const elementFraction = { x: p.clientX / ELEMENT.width, y: p.clientY / ELEMENT.height };
    const wrong = toPixelCrop(
      { ...elementFraction, width: (0.8 * 360) / ELEMENT.width, height: 0.33 },
      IMAGE.width,
      IMAGE.height,
    );

    // Starts 310px to the right of the intended edge, and 528px narrower -
    // enough to cut the brand name, the highest-weighted matching signal, in half.
    expect(wrong.x).toBe(346);
    expect(wrong.width).toBe(432);
    expect(wrong.x).toBeGreaterThan(36);
    expect(wrong.width).toBeLessThan(960);
  });
});
