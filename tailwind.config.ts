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
			fontFamily: {
				'inter': ['Inter', 'sans-serif'],
				'poppins': ['Poppins', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					light: 'hsl(var(--primary-light))',
					dark: 'hsl(var(--primary-dark))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					light: 'hsl(var(--secondary-light))'
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
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
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
			'borderMove': {
				'0%': { backgroundPosition: '0% 50%' },
				'100%': { backgroundPosition: '300% 50%' }
			},
			'car-enter': {
				'0%': { transform: 'translateX(-150%)', opacity: '0' },
				'100%': { transform: 'translateX(0)', opacity: '1' }
			},
			'car-exit': {
				'0%': { transform: 'translateX(0) scaleX(1)', filter: 'blur(0px)' },
				'50%': { transform: 'translateX(50%) scaleX(1.05)', filter: 'blur(2px)' },
				'100%': { transform: 'translateX(200%)', filter: 'blur(4px)', opacity: '0' }
			},
			'fade-in-up': {
				'0%': { opacity: '0', transform: 'translateY(10px)' },
				'100%': { opacity: '1', transform: 'translateY(0)' }
			},
			'fade-out-fast': {
				'0%': { opacity: '1' },
				'100%': { opacity: '0' }
			},
			'glow-pulse': {
				'0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
				'50%': { opacity: '0.8', transform: 'scale(1.02)' }
			},
			'border-chase': {
				'0%': { backgroundPosition: '0% 50%' },
				'100%': { backgroundPosition: '400% 50%' }
			},
			'tire-mark': {
				'0%': { width: '0px', opacity: '0' },
				'30%': { opacity: '0.8' },
				'100%': { width: '150px', opacity: '0.5' }
			},
			'tire-smoke': {
				'0%': { opacity: '0.5', transform: 'translateY(0) translateX(0) scale(1)' },
				'100%': { opacity: '0', transform: 'translateY(-25px) translateX(-50px) scale(2.5)' }
			},
			'headlight-trail': {
				'0%': { width: '0px', opacity: '0.9' },
				'100%': { width: '200px', opacity: '0' }
			},
			'power-shake': {
				'0%, 100%': { transform: 'translateX(0) translateY(0)' },
				'10%': { transform: 'translateX(-2px) translateY(1px)' },
				'20%': { transform: 'translateX(3px) translateY(-1px)' },
				'30%': { transform: 'translateX(-1px) translateY(2px)' },
				'40%': { transform: 'translateX(2px) translateY(-2px)' },
				'50%': { transform: 'translateX(-3px) translateY(1px)' },
				'60%': { transform: 'translateX(1px) translateY(-1px)' },
				'70%': { transform: 'translateX(-2px) translateY(2px)' },
				'80%': { transform: 'translateX(2px) translateY(0)' },
				'90%': { transform: 'translateX(-1px) translateY(-1px)' }
			},
			'headlight-ignite': {
				'0%, 100%': { opacity: '0.6', transform: 'scale(0.8)' },
				'50%': { opacity: '1', transform: 'scale(1.2)' }
			},
			'headlight-on': {
				'0%': { opacity: '0', transform: 'scale(0.5)' },
				'100%': { opacity: '1', transform: 'scale(1)' }
			},
			'headlight-beam': {
				'0%': { opacity: '0', transform: 'scaleX(0)' },
				'100%': { opacity: '1', transform: 'scaleX(1)' }
			},
			'text-illuminate': {
				'0%': { filter: 'drop-shadow(0 0 0px rgba(30, 144, 255, 0))' },
				'100%': { filter: 'drop-shadow(0 0 20px rgba(30, 144, 255, 0.8)) drop-shadow(0 0 40px rgba(30, 144, 255, 0.4))' }
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'border-move': 'borderMove 25s linear infinite',
			'car-enter': 'car-enter 0.9s ease-out forwards',
			'car-exit': 'car-exit 0.5s ease-in forwards',
			'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
			'fade-out-fast': 'fade-out-fast 0.3s ease-out forwards',
			'glow-pulse': 'glow-pulse 1.5s ease-in-out infinite',
			'border-chase': 'border-chase 3s linear infinite',
			'tire-mark': 'tire-mark 0.5s ease-out forwards',
			'tire-smoke': 'tire-smoke 0.7s ease-out forwards',
			'headlight-trail': 'headlight-trail 0.6s ease-out forwards',
			'power-shake': 'power-shake 0.3s ease-in-out',
			'headlight-ignite': 'headlight-ignite 0.1s ease-in-out infinite',
			'headlight-on': 'headlight-on 0.3s ease-out forwards',
			'headlight-beam': 'headlight-beam 0.4s ease-out forwards',
			'text-illuminate': 'text-illuminate 0.4s ease-out forwards'
		}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
