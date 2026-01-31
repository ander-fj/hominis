import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogIn, AlertCircle, User, Lock } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, username, password);
      
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('username', username);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Erro no login:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email ou senha inválidos');
      } else if (err.code === 'auth/invalid-email') {
        setError('Formato de email inválido');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Erro ao realizar login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Animação de partículas flutuantes
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Background com gradiente animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#501214] via-[#912325] to-[#701a1c]">
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Partículas flutuantes */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white/10 backdrop-blur-sm"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Container principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card com efeito glassmorphism */}
        <motion.div
          className="relative backdrop-blur-2xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 overflow-hidden"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.3 }}
        >
          {/* Brilho superior */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          
          <div className="p-8 md:p-10">
            {/* Logo e Título */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-center mb-8"
            >
              <motion.div
                className="w-24 h-24 mx-auto mb-6 relative"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-2xl blur-xl" />
                <div className="relative w-full h-full bg-white/90 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <img
                    src="/hominislog.jpg"
                    alt="Hominis Logo"
                    className="w-20 h-20 object-contain"
                  />
                </div>
              </motion.div>
              
              <motion.h1
                className="text-3xl font-bold text-white mb-2 tracking-tight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Hominis
              </motion.h1>
              
              <motion.p
                className="text-sm text-white/70 font-light"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Sistema de Gestão RH +SST
              </motion.p>
            </motion.div>

            {/* Formulário */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Campo Usuário */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Email
                </label>
                <motion.div
                  className="relative"
                  animate={{
                    scale: focusedField === 'username' ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <User
                      className={`w-5 h-5 transition-colors duration-200 ${
                        focusedField === 'username'
                          ? 'text-blue-400'
                          : 'text-white/40'
                      }`}
                    />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:bg-white/15 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all duration-200"
                    placeholder="Digite seu email"
                    disabled={loading}
                  />
                </motion.div>
              </motion.div>

              {/* Campo Senha */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white/90 mb-2"
                >
                  Senha
                </label>
                <motion.div
                  className="relative"
                  animate={{
                    scale: focusedField === 'password' ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock
                      className={`w-5 h-5 transition-colors duration-200 ${
                        focusedField === 'password'
                          ? 'text-blue-400'
                          : 'text-white/40'
                      }`}
                    />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:bg-white/15 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all duration-200"
                    placeholder="Digite sua senha"
                    disabled={loading}
                  />
                </motion.div>
              </motion.div>

              {/* Mensagem de Erro */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl p-3.5 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </motion.div>
              )}

              {/* Botão de Login */}
              <motion.button
                type="submit"
                disabled={loading}
                className="relative w-full mt-6 overflow-hidden group"
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-red-600 to-orange-600 rounded-xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-red-500 to-orange-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative py-3.5 px-4 flex items-center justify-center gap-2 text-white font-medium">
                  {loading ? (
                    <>
                      <motion.div
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>Entrar</span>
                    </>
                  )}
                </div>
              </motion.button>
            </form>

            {/* Rodapé */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 pt-6 border-t border-white/10"
            >
              <p className="text-xs text-center text-white/50 font-light">
                © 2025 Secontaf. Todos os direitos reservados.
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Reflexo inferior */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-gradient-to-b from-white/5 to-transparent blur-2xl rounded-full"
        />
      </motion.div>
    </div>
  );
}