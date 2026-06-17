/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF4FB',
          100: '#D6E6F5',
          500: '#6B9FD4',
          600: '#5589C0',
          700: '#3E72AB',
        },
        secondary: {
          50: '#EDF6F1',
          100: '#D1EBE0',
          500: '#8BC4A8',
          600: '#6EB190',
        },
        calm: {
          bg: '#F8F6F0',
          surface: '#FFFFFF',
          border: '#E8E4DC',
        },
        accent: {
          yellow: '#F4C878',
          coral: '#F49878',
        },
        text: {
          primary: '#2D2D2D',
          secondary: '#5C5C5C',
          muted: '#8C8C8C',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:   ['16px', '24px'],
        sm:   ['18px', '28px'],
        base: ['20px', '30px'],
        lg:   ['24px', '34px'],
        xl:   ['28px', '38px'],
        '2xl':['32px', '42px'],
        '3xl':['40px', '50px'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
