
import React from 'react';

export const LogoBird = ({ id = "disha-logo", size = 40 }: { id?: string, size?: number }) => {
  const birdColor1 = "#FFB800";
  const birdColor2 = "#D46A00";
  const greenColor = "#29A643";
  const purpleColor = "#5F259F";

  return (
    <div style={{ width: size, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`grad-bird-${id}`} x1="50" y1="50" x2="150" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={birdColor1} />
            <stop offset="100%" stopColor={birdColor2} />
          </linearGradient>
        </defs>

        {/* Stylized Bird/Flame Shape based on image */}
        <path 
          d="M100 20C100 20 80 50 100 90C120 130 140 120 150 160C150 160 140 140 110 145C80 150 60 170 50 160C40 150 70 120 75 90C80 60 70 30 100 20Z" 
          fill={`url(#grad-bird-${id})`}
        />
        <path 
          d="M100 20C100 20 115 35 125 55L100 20Z" 
          fill={birdColor1}
          opacity="0.8"
        />

        {/* Disha Text in SVG for branding consistency when just the icon size is passed */}
        <text 
          x="100" 
          y="155" 
          fill={greenColor} 
          fontFamily="'Inter', 'Arial Black', sans-serif" 
          fontSize="42" 
          fontWeight="900" 
          textAnchor="middle"
          letterSpacing="-1"
        >
          DISHA
        </text>
        <text 
          x="100" 
          y="185" 
          fill={purpleColor} 
          fontFamily="'Inter', 'Arial Black', sans-serif" 
          fontSize="24" 
          fontWeight="900" 
          textAnchor="middle"
          letterSpacing="0.5"
        >
          DIAGNOSTICS
        </text>
      </svg>
    </div>
  );
};
