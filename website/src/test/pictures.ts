export function picturesIn(element: ParentNode): string[] {
  return [...drawnPicturesIn(element), ...silhouettePicturesIn(element)];
}

export function drawnPicturesIn(element: ParentNode): string[] {
  return [...element.querySelectorAll("img")].flatMap((img) => img.getAttribute("src") ?? []);
}

export function silhouettePicturesIn(element: ParentNode): string[] {
  return [...element.querySelectorAll<HTMLElement | SVGElement>("[data-silhouette-art]")].flatMap((art) => maskedPictureOf(art) ?? []);
}

function maskedPictureOf(art: HTMLElement | SVGElement): string | undefined {
  return /^url\("(.+)"\)$/.exec(art.style.getPropertyValue("--art"))?.[1];
}
