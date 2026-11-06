// oxlint-disable no-console -- a CLI talks on stdout.

// Downloads a Font Awesome icon, Free or Pro, into `HallOfFame/UI/src/icons/fontawesome` as
// `<icon>-<style>.svg`. Run it through `mise icons:fontawesome <style> <icon>`.
//
// Font Awesome serves every style, Pro ones included, from its own site's asset host, which only
// checks the Referer. The version is the one the folder's NOTICE declares, and the license comment
// each SVG carries is stripped, the NOTICE covering it.

const VERSION = '7.3.1';

const [style, icon] = Bun.argv.slice(2);

if (style == null || icon == null) {
  throw new Error(`Usage: mise icons:fontawesome <style> <icon> (ex. duotone-light aperture)`);
}

const url = `https://site-assets.fontawesome.com/releases/v${VERSION}/svgs/${style}/${icon}.svg`;

const response = await fetch(url, { headers: { referer: 'https://fontawesome.com' } });

if (!response.ok) {
  throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
}

const body = await response.text();

const svg = body.replace(/<!--[^>]*-->/u, '');

const path = `HallOfFame/UI/src/icons/fontawesome/${icon}-${style}.svg`;

await Bun.write(path, svg);

console.info(`Wrote ${path}.`);
