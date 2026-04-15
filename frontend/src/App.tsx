import { SessionProvider } from "./app/session";
import { AppRouter } from "./app/AppRouter";

function App() {
  return (
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  );
}

export default App;
