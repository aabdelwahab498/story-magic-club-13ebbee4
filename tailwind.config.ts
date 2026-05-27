import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
        glass: {
          DEFAULT: 'hsl(var(--glass-text))',
          muted: 'hsl(var(--glass-text-muted))',
        },
        // Kid-friendly bright colors (more vibrant)
        kids: {
          blue: '#3FB8FF',       // Brighter sky blue
          purple: '#8B5CF6',
          pink: '#FF6FBE',       // Hotter pink
          yellow: '#FFD93D',     // Sunnier yellow
          green: '#4ED99A',      // Vivid mint
          orange: '#FF9F45',     // Tangerine
          red: '#FF5C72',        // Brighter coral
          softBlue: '#D3E4FD',
          softPurple: '#E5DEFF',
          softGreen: '#F2FCE2',
          softYellow: '#FEF7CD',
          midnight: '#282D57',
        }
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				xl: 'calc(var(--radius) + 0.5rem)',
				'2xl': 'calc(var(--radius) + 1rem)',
				'3xl': 'calc(var(--radius) + 1.5rem)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(-1.5deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1.5deg)' }
        },
        'float-slower': {
          '0%, 100%': { transform: 'translateY(0) rotate(-1deg)' },
          '50%': { transform: 'translateY(-6px) rotate(1deg)' }
        },
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        'twinkle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.8)' }
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' }
        },
        'pop': {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' }
        },
        'rainbow-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        },
        'letter-bounce': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-8px) rotate(-6deg)' },
          '50%': { transform: 'translateY(0) rotate(0deg)' },
          '75%': { transform: 'translateY(-4px) rotate(6deg)' }
        },
        'narrator-bob': {
          '0%, 100%': { transform: 'translateY(0) rotate(-1deg)' },
          '50%': { transform: 'translateY(-6px) rotate(1deg)' }
        },
        'lip-sync': {
          '0%, 100%': { transform: 'scaleY(0.35) scaleX(0.95)' },
          '20%': { transform: 'scaleY(1) scaleX(1)' },
          '40%': { transform: 'scaleY(0.5) scaleX(0.9)' },
          '60%': { transform: 'scaleY(1.1) scaleX(1.05)' },
          '80%': { transform: 'scaleY(0.6) scaleX(0.95)' }
        },
        'staff-glow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.25)' }
        }
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
        'float': 'float 7s ease-in-out infinite',
        'float-slow': 'float-slow 12s ease-in-out infinite',
        'float-slower': 'float-slower 18s ease-in-out infinite',
        'bounce-gentle': 'bounce-gentle 4s ease-in-out infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'twinkle': 'twinkle 5s ease-in-out infinite',
        'fade-in': 'fade-in 0.8s ease-out',
        'scale-in': 'scale-in 0.5s ease-out',
        'wiggle': 'wiggle 2.5s ease-in-out infinite',
        'pop': 'pop 0.6s ease-out',
        'rainbow-shift': 'rainbow-shift 16s ease infinite',
        'letter-bounce': 'letter-bounce 2.4s ease-in-out infinite',
        'narrator-bob': 'narrator-bob 3s ease-in-out infinite',
        'lip-sync': 'lip-sync 0.32s ease-in-out infinite',
        'staff-glow': 'staff-glow 1.4s ease-in-out infinite'
			},
      fontFamily: {
        // Default body — readable rounded sans (works great for English & Arabic via Tajawal fallback in CSS)
        'comic': ['Fredoka', 'Varela Round', 'Tajawal', 'system-ui', 'sans-serif'],
        'round': ['Fredoka', 'Varela Round', 'Tajawal', 'system-ui', 'sans-serif'],
        // Display — clean, slightly bolder for hero titles
        'display': ['Fredoka', 'Cairo', 'Varela Round', 'system-ui', 'sans-serif'],
        // Playful — opt-in for fun decorative bits (NOT for paragraphs)
        'playful': ['"Bubblegum Sans"', '"Lilita One"', 'Fredoka', 'sans-serif'],
        // Logo — keep the marker look just for the brand mark
        'logo': ['"Bagel Fat One"', '"Lilita One"', '"Gochi Hand"', 'Fredoka', 'sans-serif'],
      }
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
