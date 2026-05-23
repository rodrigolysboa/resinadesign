'use client';

import * as React from 'react';
import { Upload, Sliders, Image as ImageIcon, Check, RefreshCw } from 'lucide-react';

interface TraceFrameCreatorProps {
  onFrameCreated: (name: string, dataUrl: string) => void;
}

export default function TraceFrameCreator({ onFrameCreated }: TraceFrameCreatorProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [threshold, setThreshold] = React.useState<number>(128);
  const [mode, setMode] = React.useState<'auto' | 'alpha' | 'dark' | 'light'>('auto');
  const [frameName, setFrameName] = React.useState<string>('Meu Molde Personalizado');
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const applyFilter = React.useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We want a square frame canvas for masks (e.g., 300x300)
    canvas.width = 300;
    canvas.height = 300;

    // Calculate aspect ratio fit centered
    const scale = Math.min(300 / img.width, 300 / img.height);
    const x = (300 - img.width * scale) / 2;
    const y = (300 - img.height * scale) / 2;
    const w = img.width * scale;
    const h = img.height * scale;

    ctx.clearRect(0, 0, 300, 300);
    ctx.drawImage(img, x, y, w, h);

    const imgData = ctx.getImageData(0, 0, 300, 300);
    const data = imgData.data;

    // Precalculate background characteristics for 'auto' mode
    let isTransparentBg = false;
    let transparentCornerCount = 0;
    const corners = [
      0, // top-left
      (300 - 1) * 4, // top-right
      (300 - 1) * 300 * 4, // bottom-left
      ((300 - 1) * 300 + (300 - 1)) * 4 // bottom-right
    ];
    
    corners.forEach(idx => {
      if (data[idx + 3] < 100) {
        transparentCornerCount++;
      }
    });

    if (transparentCornerCount >= 2) {
      isTransparentBg = true;
    }

    // Sample average background color when not transparent
    let bgR = 0, bgG = 0, bgB = 0;
    corners.forEach(idx => {
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    });
    bgR /= 4;
    bgG /= 4;
    bgB /= 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];

      if (mode === 'auto') {
        if (isTransparentBg) {
          // If background is mostly transparent, use alpha channel
          if (a > threshold) {
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
            data[i+3] = 255;
          } else {
            data[i+3] = 0;
          }
        } else {
          // Opaque background. Calculate color distance from estimated backdrop
          const diffR = r - bgR;
          const diffG = g - bgG;
          const diffB = b - bgB;
          const distance = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);

          // If distance from background color is greater than threshold, it is the foreground!
          if (distance > threshold && a > 30) {
            data[i] = 0;
            data[i+1] = 0;
            data[i+2] = 0;
            data[i+3] = 255; // Solid silhouette
          } else {
            data[i+3] = 0; // Clear background
          }
        }
      } else if (mode === 'alpha') {
        // Mode 1: Transparency channel based (for transparent backgrounds PNGs)
        // If alpha is above threshold, convert to black. Otherwise, keep transparent
        if (a > threshold) {
          data[i] = 0;     // R
          data[i+1] = 0;   // G
          data[i+2] = 0;   // B
          data[i+3] = 255; // Solid black
        } else {
          data[i+3] = 0;   // Transparent
        }
      } else if (mode === 'dark') {
        // Mode 2: Dark silhouette detection (isolates dark shapes on white/light backgrounds)
        const brightness = (r + g + b) / 3;
        if (brightness < threshold && a > 30) {
          data[i] = 0;
          data[i+1] = 0;
          data[i+2] = 0;
          data[i+3] = 255; // Solid black outline
        } else {
          data[i+3] = 0;   // Transparent
        }
      } else {
        // Mode 3: Light silhouette detection (isolates light shapes on dark backgrounds)
        const brightness = (r + g + b) / 3;
        if (brightness > threshold && a > 30) {
          data[i] = 0;
          data[i+1] = 0;
          data[i+2] = 0;
          data[i+3] = 255; // Solid black outline
        } else {
          data[i+3] = 0;   // Transparent
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [mode, threshold]);

  // Trigger preview when file or filters change
  React.useEffect(() => {
    if (!imagePreview) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imagePreview;
    img.onload = () => {
      applyFilter(img);
    };
  }, [imagePreview, applyFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFrameName(selectedFile.name.replace(/\.[^/.]+$/, "") + " (Molde)");
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImagePreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const generateFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imagePreview) return;
    
    setIsProcessing(true);
    try {
      // Get isolated frame PNG data url
      const dataUrl = canvas.toDataURL('image/png');
      onFrameCreated(frameName, dataUrl);
      
      // Reset
      setFile(null);
      setImagePreview(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#2b2d31] border border-[#3f4147] rounded-lg p-4 text-xs">
      <h3 className="text-sm font-semibold mb-2 text-[#007fff] flex items-center gap-1.5">
        <RefreshCw className="w-4 h-4" /> 
        Criador de Moldes (Foto para Máscara)
      </h3>
      <p className="text-gray-400 mb-3 leading-relaxed">
        Transforme qualquer imagem ou contorno em uma moldura vazada. Coloque qualquer outra foto perfeitamente dentro dela para imprimir!
      </p>

      {!imagePreview ? (
        <label className="border-2 border-dashed border-[#4e5058] hover:border-[#007fff] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition text-center bg-[#1e1f22]">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <span className="font-medium text-gray-300">Escolha uma Imagem</span>
          <span className="text-[10px] text-gray-500 mt-1">PNG transparente ou silhueta de plano de fundo</span>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-4 items-center bg-[#1e1f22] p-2 rounded border border-[#3f4147]">
            {/* Real Canvas Preview */}
            <div className="relative w-24 h-24 bg-white/5 border border-dashed border-gray-600 rounded flex items-center justify-center overflow-hidden pattern-bg">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <span className="text-gray-400 block mb-1">Método de Captura:</span>
                <div className="grid grid-cols-4 gap-1 text-[9px]">
                  <button 
                    onClick={() => setMode('auto')}
                    className={`py-1 px-1 rounded text-center font-semibold transition ${mode === 'auto' ? 'bg-[#007fff] text-white' : 'bg-[#2b2d31] hover:bg-gray-700 text-gray-400'}`}
                  >
                    Auto
                  </button>
                  <button 
                    onClick={() => setMode('alpha')}
                    className={`py-1 px-1 rounded text-[#007fff] hover:text-white transition ${mode === 'alpha' ? 'bg-[#007fff] text-white' : 'bg-[#2b2d31] hover:bg-gray-700 text-gray-400'}`}
                  >
                    Alfa
                  </button>
                  <button 
                    onClick={() => setMode('dark')}
                    className={`py-1 px-1 rounded text-[#007fff] hover:text-[#007fff] transition ${mode === 'dark' ? 'bg-[#007fff] text-white' : 'bg-[#2b2d31] hover:bg-gray-700 text-gray-400'}`}
                  >
                    Escuro
                  </button>
                  <button 
                    onClick={() => setMode('light')}
                    className={`py-1 px-1 rounded text-[#007fff] hover:text-[#007fff] transition ${mode === 'light' ? 'bg-[#007fff] text-white' : 'bg-[#2b2d31] hover:bg-gray-700 text-gray-400'}`}
                  >
                    Claro
                  </button>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-gray-400 mb-1">
                  <span>Limite de Recorte:</span>
                  <span className="font-mono text-[#007fff] font-bold">{threshold}</span>
                </label>
                <input 
                  type="range" 
                  min="5" 
                  max="250" 
                  value={threshold} 
                  onChange={(e) => setThreshold(parseInt(e.target.value))} 
                  className="w-full accent-[#007fff]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-gray-400 block mb-1">Nome do Molde</label>
            <input 
              type="text" 
              value={frameName} 
              onChange={(e) => setFrameName(e.target.value)} 
              className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#007fff]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setImagePreview(null);
                setFile(null);
              }}
              className="flex-1 py-1.5 rounded bg-transparent hover:bg-white/5 border border-gray-600 transition text-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={generateFrame}
              disabled={isProcessing}
              className="flex-1 py-1.5 rounded bg-[#007fff] hover:bg-blue-600 transition text-white font-medium flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {isProcessing ? 'Processando...' : 'Criar Frame'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
