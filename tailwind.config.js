/** Tailwind config untuk Dashboard RT (dipakai untuk build CSS statis).

 *  Menggantikan Tailwind Play CDN (cdn.tailwindcss.com) agar halaman tidak
 *  perlu meng-unduh engine Tailwind + generate CSS saat runtime.

 *  Regenerate setelah mengubah kelas Tailwind di index.html / public.html:
 *    npx tailwindcss@3 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
 */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './public.html', './config.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0284c7',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
        }
      }
    }
  }
};
