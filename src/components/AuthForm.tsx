import { useState, useCallback } from 'react';
import { signIn, signUp } from '@/lib/supabase';
import { PASSWORD_MIN_LENGTH } from '@/lib/featureFlags.client';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

export default function AuthForm({ mode, onSuccess, onError }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState(''); // Anti-bot field
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  const isSignUp = mode === 'signup';

  // Calculate password strength
  const calculatePasswordStrength = useCallback((pwd: string): PasswordStrength => {
    if (pwd.length < PASSWORD_MIN_LENGTH) return 'weak';

    let strength = 0;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++; // Mixed case
    if (/\d/.test(pwd)) strength++; // Has numbers
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++; // Has special chars

    if (strength <= 1) return 'weak';
    if (strength <= 2) return 'medium';
    return 'strong';
  }, []);

  // Validate password client-side
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    return null;
  };

  // Debounced password change handler
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (isSignUp && value.length > 0) {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Honeypot check - if filled, it's likely a bot
    if (honeypot) {
      console.warn('[AuthForm] Honeypot field filled - potential bot detected');
      setError('An error occurred. Please try again.');
      setLoading(false);
      return;
    }

    // Client-side validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        // Redirect to dashboard after successful signup
        window.location.href = '/dashboard';
        return; // Prevent setLoading(false) since we're navigating away
      } else {
        await signIn(email, password);
        // Redirect to dashboard after successful signin
        window.location.href = '/dashboard';
        return; // Prevent setLoading(false) since we're navigating away
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      if (onError) {
        onError(err as Error);
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-sm">
      {/* Honeypot field - hidden from users, catches bots */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website (leave blank)</label>
        <input
          id="website"
          name="website"
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {isSignUp && (
        <div>
          <label htmlFor="fullName" className="block text-label font-medium text-foreground mb-xs">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required={isSignUp}
            className="w-full h-12 px-md border border-border rounded-lg bg-input text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-default ease-default shadow-ambient"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-label font-medium text-foreground mb-xs">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full h-12 px-md border border-border rounded-lg bg-input text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-default ease-default shadow-ambient"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-label font-medium text-foreground mb-xs">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          required
          minLength={PASSWORD_MIN_LENGTH}
          className="w-full h-12 px-md border border-border rounded-lg bg-input text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-default ease-default shadow-ambient"
          placeholder="••••••••"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
        {isSignUp && (
          <>
            <p className="mt-xs text-body-small text-muted-foreground">
              Must be at least {PASSWORD_MIN_LENGTH} characters
            </p>
            {passwordStrength && password.length >= PASSWORD_MIN_LENGTH && (
              <div className="mt-xs">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength === 'weak'
                          ? 'w-1/3 bg-destructive'
                          : passwordStrength === 'medium'
                          ? 'w-2/3 bg-yellow-500'
                          : 'w-full bg-primary'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      passwordStrength === 'weak'
                        ? 'text-destructive'
                        : passwordStrength === 'medium'
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : 'text-primary'
                    }`}
                  >
                    {passwordStrength === 'weak' ? 'Weak' : passwordStrength === 'medium' ? 'Medium' : 'Strong'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="p-md rounded-lg bg-destructive/10 border border-destructive text-destructive text-body-small">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 px-lg bg-primary text-primary-foreground rounded-full font-medium shadow-sm hover:shadow-raised hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-all duration-default ease-default active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
      </button>
    </form>
  );
}
