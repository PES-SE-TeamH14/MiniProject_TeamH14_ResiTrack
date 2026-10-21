import { createContext } from 'react';

// Holds { user, login, logout }. Provided by AuthProvider, read with useAuth().
const AuthContext = createContext(null);

export default AuthContext;
