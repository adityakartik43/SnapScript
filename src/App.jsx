import React from 'react'
import Navbar from './components/Navbar.jsx'
import Test from './components/Test.jsx'
import UploadAndGenerate from './components/UploadAndGenerate.jsx'

const App = () => {
  return (
    <>
      <Navbar />
      <div className="flex justify-center items-center min-h-[80vh]">
        <UploadAndGenerate />
      </div>

      {/* <Test /> */}
    </>
  )
}

export default App
