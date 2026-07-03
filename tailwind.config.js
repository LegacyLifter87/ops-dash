/** Tailwind config for the prebuilt static CSS (generated via the standalone CLI).
 *  Regenerate after UI changes:  ./tailwindcss.exe -c tailwind.config.js -i tw-input.css -o tailwind.css --minify
 *  Mirrors the colors that were in index.html's Play-CDN inline config. */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#f1fafb',100:'#e1f3f5',200:'#c4e7eb',300:'#9bd5dd',
          400:'#6cc0cb',500:'#50b0bd',600:'#46a3b0',700:'#3a8893',
          800:'#316e78',900:'#2c5c64',950:'#183036'
        },
        accent: {
          50:'#fef4ee',100:'#fde6d6',200:'#fbc9ac',300:'#f8a578',
          400:'#f5894f',500:'#f2884d',600:'#e5733a',700:'#bf5a2c',
          800:'#984829',900:'#7c3d25',950:'#431d11'
        }
      }
    }
  },
};
