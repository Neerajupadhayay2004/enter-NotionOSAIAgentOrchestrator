import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
				status: {
					negotiating: 'hsl(var(--status-negotiating))',
					'negotiating-foreground': 'hsl(var(--status-negotiating-foreground))',
					pending: 'hsl(var(--status-pending))',
					'pending-foreground': 'hsl(var(--status-pending-foreground))',
					approved: 'hsl(var(--status-approved))',
					'approved-foreground': 'hsl(var(--status-approved-foreground))',
					rejected: 'hsl(var(--status-rejected))',
					'rejected-foreground': 'hsl(var(--status-rejected-foreground))',
					completed: 'hsl(var(--status-completed))',
					'completed-foreground': 'hsl(var(--status-completed-foreground))'
				},
				actor: {
					marketing: 'hsl(var(--actor-marketing))',
					finance: 'hsl(var(--actor-finance))',
					human: 'hsl(var(--actor-human))',
					system: 'hsl(var(--actor-system))'
				},
				severity: {
					low: 'hsl(var(--severity-low))',
					'low-foreground': 'hsl(var(--severity-low-foreground))',
					medium: 'hsl(var(--severity-medium))',
					'medium-foreground': 'hsl(var(--severity-medium-foreground))',
					high: 'hsl(var(--severity-high))',
					'high-foreground': 'hsl(var(--severity-high-foreground))',
					critical: 'hsl(var(--severity-critical))',
					'critical-foreground': 'hsl(var(--severity-critical-foreground))'
				},
				verdict: {
					clean: 'hsl(var(--verdict-clean))',
					'clean-foreground': 'hsl(var(--verdict-clean-foreground))',
					suspicious: 'hsl(var(--verdict-suspicious))',
					'suspicious-foreground': 'hsl(var(--verdict-suspicious-foreground))',
					malicious: 'hsl(var(--verdict-malicious))',
					'malicious-foreground': 'hsl(var(--verdict-malicious-foreground))',
					unknown: 'hsl(var(--verdict-unknown))',
					'unknown-foreground': 'hsl(var(--verdict-unknown-foreground))'
				},
				'incident-status': {
					detected: 'hsl(var(--incident-status-detected))',
					'detected-foreground': 'hsl(var(--incident-status-detected-foreground))',
					analyzing: 'hsl(var(--incident-status-analyzing))',
					'analyzing-foreground': 'hsl(var(--incident-status-analyzing-foreground))',
					pending: 'hsl(var(--incident-status-pending))',
					'pending-foreground': 'hsl(var(--incident-status-pending-foreground))',
					resolved: 'hsl(var(--incident-status-resolved))',
					'resolved-foreground': 'hsl(var(--incident-status-resolved-foreground))',
					dismissed: 'hsl(var(--incident-status-dismissed))',
					'dismissed-foreground': 'hsl(var(--incident-status-dismissed-foreground))'
				},
				agent: {
					'threat-detection': 'hsl(var(--agent-threat-detection))',
					'malware-analysis': 'hsl(var(--agent-malware-analysis))',
					'incident-response': 'hsl(var(--agent-incident-response))',
					compliance: 'hsl(var(--agent-compliance))',
					human: 'hsl(var(--agent-human))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;