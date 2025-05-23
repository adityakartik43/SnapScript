import React, { useState } from "react";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="bg-[#1a1a52] px-6 py-4">
      <div className="flex justify-between items-center">
        {/* Logo */}
        <div className="border border-gradient-to-r from-green-400 to-blue-400 p-2 rounded">
          <span className="text-green-400 font-semibold tracking-wide text-lg">SnapScript</span>
        </div>

        {/* Hamburger (Mobile) */}
        <div className="lg:hidden text-white" onClick={toggleMenu}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </div>

        {/* Menu (Desktop) */}
        <ul className="hidden lg:flex items-center space-x-8 text-white font-medium">
          <li className="hover:text-blue-300 cursor-pointer">Home</li>
          <li className="hover:text-blue-300 cursor-pointer">Our Services</li>
          <li className="hover:text-blue-300 cursor-pointer">Courses</li>
          <li className="hover:text-blue-300 cursor-pointer">Resource Hub</li>
          <li className="hover:text-blue-300 cursor-pointer">About</li>
          <li>
            <button className="bg-blue-500 hover:bg-pink-600 duration-500 text-white font-semibold px-4 py-2 rounded">
              Contact Us
            </button>
          </li>
        </ul>
      </div>

      {/* Mobile Menu with smooth transition */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-500 ease-in-out ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <ul className="flex flex-col space-y-4 mt-4 text-white font-medium">
          <li className="hover:text-blue-300 cursor-pointer">Home</li>
          <li className="hover:text-blue-300 cursor-pointer">Our Services</li>
          <li className="hover:text-blue-300 cursor-pointer">Courses</li>
          <li className="hover:text-blue-300 cursor-pointer">Resource Hub</li>
          <li className="hover:text-blue-300 cursor-pointer">About</li>
          <li>
            <button className="bg-blue-500 hover:bg-pink-600 duration-500 text-white font-semibold px-4 py-2 rounded w-full">
              Contact Us
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
