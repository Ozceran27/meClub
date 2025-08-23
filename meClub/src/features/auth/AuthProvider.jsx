import { AuthProvider as Provider } from './useAuth';

export default function AuthProvider({ children }) {
  return <Provider>{children}</Provider>;
}
