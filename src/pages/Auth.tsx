import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Phone, Wallet, Lock, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

interface AuthProps {
  mode: 'login' | 'signup' | 'demo';
}

const Auth = ({ mode }: AuthProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    income: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'demo') {
      setFormData({
        fullName: 'Demo User',
        email: 'demo@example.com',
        password: 'demopassword123',
        phone: '9876543210',
        income: '1200000',
      });
    } else {
      setFormData({ fullName: '', email: '', password: '', phone: '', income: '' });
      setErrors({});
    }
    setApiError('');
  }, [mode]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (mode === 'signup' || mode === 'demo') {
      if (!formData.fullName) newErrors.fullName = 'Name is required';
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        newErrors.phone = 'Enter a valid 10-digit phone number';
      }
      if (!formData.income) newErrors.income = 'Annual income is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const isSignup = mode === 'signup' || mode === 'demo';
      const endpoint = isSignup ? '/api/signup' : '/api/login';
      const body = isSignup
        ? {
            fullName: formData.fullName,
            email: formData.email,
            password: formData.password,
            phone: formData.phone || undefined,
            income: formData.income ? Number(formData.income) : undefined,
          }
        : { email: formData.email, password: formData.password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setApiError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/chat');
    } catch {
      setApiError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -ml-48 -mb-48" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg relative z-10"
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>

        <Card className="p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {mode === 'signup' ? 'Create your account' : mode === 'demo' ? 'Explore Demo' : 'Welcome back'}
            </h1>
            <p className="text-slate-500">
              {mode === 'signup'
                ? 'Set up your account to get personalized guidance'
                : mode === 'demo'
                ? 'Create a real demo account to try AI Money Mentor'
                : 'Enter your credentials to continue'}
            </p>
          </div>

          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {(mode === 'signup' || mode === 'demo') && (
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                icon={<User className="w-5 h-5" />}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                error={errors.fullName}
              />
            )}

            <Input
              label="Email"
              placeholder="you@example.com"
              icon={<Mail className="w-5 h-5" />}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              icon={<Lock className="w-5 h-5" />}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
            />

            {(mode === 'signup' || mode === 'demo') && (
              <>
                <Input
                  label="Phone Number (optional)"
                  placeholder="10-digit number"
                  icon={<Phone className="w-5 h-5" />}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  error={errors.phone}
                />
                <Input
                  label="Approx. Annual Income"
                  placeholder="0"
                  icon={<Wallet className="w-5 h-5" />}
                  value={formData.income}
                  onChange={(e) => setFormData({ ...formData, income: e.target.value })}
                  error={errors.income}
                />
              </>
            )}

            <Button className="w-full h-14 text-lg mt-4 font-bold" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signup' ? 'Sign Up' : mode === 'demo' ? 'Create Demo Account' : 'Login'}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            {mode === 'signup' ? (
              <p className="text-slate-500">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-emerald-600 font-bold hover:underline">
                  Login here
                </button>
              </p>
            ) : mode === 'login' ? (
              <p className="text-slate-500">
                New to Money Mentor?{' '}
                <button onClick={() => navigate('/signup')} className="text-emerald-600 font-bold hover:underline">
                  Sign up for free
                </button>
              </p>
            ) : null}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
