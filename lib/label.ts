import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNShare from 'react-native-share';
import { bitsFor, isValidEan13 } from '../components/BarcodeView';

export const LABEL_SIZES: [number, number][] = [
  [50, 30],
  [50, 25],
  [38, 25],
  [40, 30],
  [60, 40],
  [100, 50],
]; // mm (width x height)
const PT_PER_MM = 72 / 25.4;
const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    c =>
      ((
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<
          string,
          string
        >
      )[c]),
  );

type LabelProduct = {
  name: string;
  sku: string;
  price: number;
  barcode: string;
};

// HTML of one sticker: name, SKU + price, barcode and its number. Sizes scale with the sticker height.
export function labelHtml(p: LabelProduct, w: number, h: number) {
  let bars = '';
  if (isValidEan13(p.barcode)) {
    const bits = bitsFor(p.barcode);
    const quiet = 9,
      W = bits.length + quiet * 2;
    let rects = '';
    for (let i = 0; i < bits.length; ) {
      if (bits[i] !== '1') {
        i++;
        continue;
      }
      let n = 1;
      while (bits[i + n] === '1') n++;
      rects += `<rect x="${i + quiet}" y="0" width="${n}" height="1"/>`;
      i += n;
    }
    bars = `<svg viewBox="0 0 ${W} 1" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:${(
      h * 0.42
    ).toFixed(
      1,
    )}mm;display:block"><rect width="${W}" height="1" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  }
  return `<html><head><meta name="viewport" content="width=device-width"/><style>
@page{size:${w}mm ${h}mm;margin:0}
html,body{margin:0;padding:0;width:${w}mm;height:${h}mm;background:#fff}
.l{width:${w}mm;height:${h}mm;padding:1.5mm;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000}
.n{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;font-size:${(
    h * 0.085
  ).toFixed(2)}mm;line-height:1.15}
.s{font-size:${(h * 0.07).toFixed(2)}mm;line-height:1.15;margin-bottom:0.8mm}
.c{font-size:${(h * 0.075).toFixed(
    2,
  )}mm;letter-spacing:0.3mm;font-weight:600;line-height:1.1}
</style></head><body><div class="l"><div class="n">${esc(
    p.name,
  )}</div><div class="s">${esc(p.sku)} · ₹${
    p.price
  }</div>${bars}<div class="c">${esc(p.barcode)}</div></div></body></html>`;
}

// Makes a PDF whose page is exactly the sticker size, then opens the share / print sheet
export async function shareLabel(p: LabelProduct, w: number, h: number) {
  const file = await RNHTMLtoPDF.convert({
    html: labelHtml(p, w, h),
    fileName: `label_${p.sku}`.replace(/[^\w-]/g, '_'),
    directory: 'Documents',
    width: Math.round(w * PT_PER_MM),
    height: Math.round(h * PT_PER_MM),
  });
  await RNShare.open({
    url: `file://${file.filePath}`,
    type: 'application/pdf',
    failOnCancel: false,
  });
}
