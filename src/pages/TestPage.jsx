import React from 'react';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 animate-pulse">
            🎉 Tailwind CSS Test Suite
          </h1>
          <p className="text-lg text-gray-600">
            Complete verification of Tailwind CSS functionality
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Colors & Typography */}
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Colors & Typography</h2>
            <div className="space-y-3">
              <p className="text-red-500 font-bold">Red Bold Text</p>
              <p className="text-green-600 italic">Green Italic Text</p>
              <p className="text-blue-700 underline">Blue Underlined Text</p>
              <p className="text-purple-800 text-sm">Small Purple Text</p>
              <p className="text-yellow-600 text-2xl">Large Yellow Text</p>
            </div>
          </div>

          {/* Spacing & Layout */}
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Spacing & Layout</h2>
            <div className="flex flex-col space-y-2">
              <div className="bg-red-200 p-2 rounded">Padding 2</div>
              <div className="bg-green-200 p-4 rounded">Padding 4</div>
              <div className="bg-blue-200 p-6 rounded">Padding 6</div>
            </div>
            <div className="flex justify-between mt-4">
              <div className="bg-yellow-200 w-8 h-8 rounded"></div>
              <div className="bg-purple-200 w-12 h-12 rounded-full"></div>
              <div className="bg-pink-200 w-16 h-16 rounded-lg"></div>
            </div>
          </div>

          {/* Responsive Grid */}
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Responsive Grid</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-indigo-100 text-indigo-800 p-3 rounded text-center text-sm font-medium">
                  Item {i}
                </div>
              ))}
            </div>
          </div>

          {/* Buttons & Interactive */}
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Buttons & Interactive</h2>
            <div className="space-y-3">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors w-full">
                Primary Button
              </button>
              <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors w-full">
                Secondary Button
              </button>
              <button className="border-2 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white px-4 py-2 rounded-lg transition-all w-full">
                Outline Button
              </button>
            </div>
          </div>

          {/* Shadows & Effects */}
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Shadows & Effects</h2>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-pink-500 to-violet-500 p-4 rounded-lg text-white text-center shadow-md">
                Gradient + Shadow
              </div>
              <div className="bg-yellow-200 p-3 rounded-lg shadow-xl transform hover:scale-105 transition-transform cursor-pointer">
                Hover Scale Effect
              </div>
              <div className="bg-green-200 p-3 rounded-full text-center shadow-inner">
                Inner Shadow
              </div>
            </div>
          </div>

          {/* Custom Variables */}
          <div className="bg-card p-6 rounded-xl shadow-lg border border-border">
            <h2 className="text-xl font-semibold text-card-foreground mb-4">Custom CSS Variables</h2>
            <div className="space-y-3">
              <div className="bg-primary text-primary-foreground p-3 rounded">Primary Colors</div>
              <div className="bg-secondary text-secondary-foreground p-3 rounded">Secondary Colors</div>
              <div className="bg-muted text-muted-foreground p-3 rounded">Muted Colors</div>
              <div className="bg-accent text-accent-foreground p-3 rounded">Accent Colors</div>
            </div>
          </div>

        </div>

        {/* Status Indicator */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full font-semibold">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            ✅ All Tailwind CSS features are working correctly!
          </div>
          <p className="mt-4 text-sm text-gray-500">
            If you can see all the colors, layouts, and animations above, Tailwind CSS is fully functional.
          </p>
        </div>

      </div>
    </div>
  );
}