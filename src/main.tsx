import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { MantineProvider} from '@mantine/core'



ReactDOM.createRoot(document.getElementById('root')!).render(
 
    <MantineProvider  defaultColorScheme="light">
      <App />
    </MantineProvider>
  
)