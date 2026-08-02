import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Bot,
  User,
  Download,
  LayoutDashboard,
  TrendingUp,
  LogOut,
  ChevronRight,
  Calculator
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/Button';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface StoredUser {
  id: number;
  fullName: string;
  email: string;
  income?: number;
}

const DashboardChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      navigate('/login');
      return;
    }
    const userData: StoredUser = JSON.parse(storedUser);
    setUser(userData);

    const loadHistory = async () => {
      try {
        const response = await fetch('/api/messages', {
          headers: { Authorization: 'Bearer ' + token },
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setMessages(
            data.map((m: { id: number; text: string; sender: 'user' | 'ai'; createdAt: string }) => ({
              id: String(m.id),
              text: m.text,
              sender: m.sender,
              timestamp: new Date(m.createdAt),
            }))
          );
        } else {
          setMessages([
            {
              id: '1',
              text: 'Hello ' + userData.fullName + '! I am your AI Money Mentor. Based on your income of Rs.' + userData.income + ', I have analyzed potential investment and tax-saving opportunities for you. How can I help you today?',
              sender: 'ai',
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        setMessages([
          {
            id: '1',
            text: 'Hello ' + userData.fullName + '! How can I help you today?',
            sender: 'ai',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ message: input }),
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to communicate with AI');
      }

      const data = await response.json();
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.text,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'I encountered an issue. Please check if the backend is running.';
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Error: ' + message,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!chatContainerRef.current || !user) return;
    const canvas = await html2canvas(chatContainerRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('MoneyMentor_Plan_' + user.fullName + '.pdf');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const SuggestionChip = ({ text }: { text: string }) => (
    <button
      onClick={() => setInput(text)}
      className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-100 hover:bg-emerald-100 transition-colors"
    >
      {text}
    </button>
  );

  const MessageBubble = ({ message }: { message: Message }) => {
    const isSpecial = message.text.includes('[INVESTMENT_PLAN]') || message.text.includes('[TAX_ADVICE]');

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex w-full mb-6',
          message.sender === 'user' ? 'justify-end' : 'justify-start'
        )}
      >
        <div className={cn(
          'flex max-w-[85%] md:max-w-[70%] gap-3',
          message.sender === 'user' && 'flex-row-reverse'
        )}>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
            message.sender === 'user' ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'
          )}>
            {message.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
          </div>

          <div className={cn(
            'space-y-2',
            message.sender === 'user' ? 'items-end text-right' : 'items-start'
          )}>
            <div className={cn(
              'px-5 py-3 rounded-2xl shadow-sm leading-relaxed',
              message.sender === 'user'
                ? 'bg-slate-900 text-white'
                : message.text.startsWith('Error:')
                ? 'bg-red-50 border border-red-100 text-red-700'
                : isSpecial
                ? 'bg-white border-2 border-emerald-100 ring-4 ring-emerald-50/50'
                : 'bg-white border border-slate-100'
            )}>
              {isSpecial && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-50 text-emerald-600 font-bold uppercase text-xs tracking-wider">
                  <Calculator className="w-4 h-4" />
                  {message.text.includes('[INVESTMENT_PLAN]') ? 'Personalized Wealth Plan' : 'Tax Optimization Summary'}
                </div>
              )}
              <div className="prose prose-sm prose-emerald max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.text.replace(/\[INVESTMENT_PLAN\]|\[TAX_ADVICE\]/g, '')}
                </ReactMarkdown>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-medium px-1">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  if (historyLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100" />
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce delay-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-slate-900">MoneyMentor</span>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12"
            onClick={() => navigate('/sips')}
          >
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            SIP Explorer
          </Button>
        </div>

        <div className="flex-1 p-4 flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">History</label>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl font-medium text-sm flex items-center justify-between group cursor-pointer transition-all border border-emerald-100">
             General Consultation
             <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="text-slate-600 w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">{user?.fullName || 'User'}</span>
              <span className="text-[10px] text-slate-500">{user?.email}</span>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 h-10 text-slate-500 hover:text-red-500 hover:bg-red-50" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">Financial Advisor</h2>
            <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase tracking-wider">
              AI Powered
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-10 px-4" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export Plan
            </Button>
            <Button className="h-10 px-4 lg:hidden" onClick={() => navigate('/sips')}>
              SIP Explorer
            </Button>
          </div>
        </header>

        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6 scrollbar-hide bg-[#fbfcfd]"
        >
          <div className="max-w-4xl mx-auto py-8">
            <AnimatePresence>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 mb-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200" />
                      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce delay-300" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {!isLoading && messages.length === 1 && (
          <div className="p-4 flex gap-3 overflow-x-auto scrollbar-hide max-w-4xl mx-auto w-full no-scrollbar">
            <SuggestionChip text="Old vs New tax?" />
            <SuggestionChip text="Invest 20k per month" />
            <SuggestionChip text="Best tax saving SIPs" />
            <SuggestionChip text="Plan for retirement" />
          </div>
        )}

        <div className="p-6 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative group">
            <input
              type="text"
              placeholder="Ask anything about investments or taxes..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 pr-20 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-50/50 focus:border-emerald-600 transition-all text-lg"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 top-3 w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-widest">
            Always verify financial advice with a certified professional.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardChat;
