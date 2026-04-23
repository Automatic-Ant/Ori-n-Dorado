import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  // Warmup: wake up the Supabase connection pool as soon as the login page loads,
  // so the DB is ready by the time the user finishes typing their credentials.
  useEffect(() => {
    supabase.from('products').select('id').limit(1).maybeSingle();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-overlay"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="login-card glass"
      >
        <div className="login-header">
          <div className="logo-container">
            <img src="/logo.png" alt="Orion Dorado Logo" className="login-logo-img" />
          </div>
          <h1 className="gold-gradient">Orión Dorado</h1>
          <p>Casa de Electricidad</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="error-message"
              >
                <AlertCircle size={18} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="input-group">
            <label htmlFor="username">Usuario</label>
            <div className="input-with-icon">
              <User className="icon" size={20} />
              <input
                id="username"
                type="text"
                placeholder="nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          </div>


          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-with-icon">
              <Lock className="icon" size={20} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="eye-icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <>
                <LogIn size={20} />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>&copy; 2026 Orión Dorado | Sucursal Centro</p>
        </div>
      </motion.div>

      <style jsx>{`
        .login-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #050505;
          z-index: 1000;
          overflow: hidden;
        }

        .login-overlay {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, rgba(212, 175, 55, 0.1) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 3rem;
          border-radius: 24px;
          position: relative;
          z-index: 1;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .login-logo-img {
          width: 150px;
          height: auto;
          filter: drop-shadow(0 10px 20px rgba(212, 175, 55, 0.4));
          animation: logo-glow 3s infinite ease-in-out;
        }

        @keyframes logo-glow {
          0%, 100% { filter: drop-shadow(0 10px 20px rgba(212, 175, 55, 0.4)); }
          50% { filter: drop-shadow(0 10px 40px rgba(212, 175, 55, 0.6)); }
        }

        .login-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          letter-spacing: -1px;
        }

        .login-header p {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .error-message {
          background: rgba(231, 76, 60, 0.1);
          border: 1px solid var(--error);
          color: var(--error);
          padding: 0.75rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.85rem;
          overflow: hidden;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-left: 0.25rem;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon .icon {
          position: absolute;
          left: 1rem;
          color: var(--text-secondary);
          pointer-events: none;
        }

        .input-with-icon input {
          width: 100%;
          padding-left: 3rem;
          height: 54px;
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .input-with-icon input:focus {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--primary-gold);
          box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.1);
        }

        .eye-icon {
          position: absolute;
          right: 1rem;
          background: none;
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem;
        }

        .login-btn {
          height: 54px;
          justify-content: center;
          font-size: 1rem;
          margin-top: 1rem;
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 2.5rem;
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-secondary);
          opacity: 0.6;
        }

        @media (max-width: 768px) {
          .login-card {
            padding: 2rem 1.5rem;
            border-radius: 16px;
          }
          .login-logo-img {
            width: 110px;
          }
          .login-header h1 {
            font-size: 1.6rem;
          }
          .logo-container {
            margin-bottom: 1.25rem;
          }
          .login-header {
            margin-bottom: 1.75rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
