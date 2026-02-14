/**
 * BeaverReader - React Native App Entry Point
 */

import React from 'react';
import {AuthProvider} from './src/contexts/AuthContext';
import {AppNavigator} from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

export default App;
