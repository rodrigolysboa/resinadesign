'use client';

import * as React from 'react';
import { 
  Plus, Save, Trash2, Copy, FileDown, Printer, Undo2, Redo2, 
  ZoomIn, ZoomOut, Grid, HelpCircle, LogOut, Check, Search, 
  Lock, Unlock, ChevronUp, ChevronDown, AlignLeft, AlignCenter, 
  AlignRight, FlipHorizontal, FlipVertical, Move, FileSpreadsheet, Eye, EyeOff, RotateCw, 
  Layers, Hammer, UploadCloud, Info, Type, LayoutGrid, Award, HardDrive,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Local types and helpers
import { 
  SheetElement, 
  Project, 
  ProjectSheet,
  generateAlphabetSheetElements,
  CATEGORIES, 
  SHAPE_PATHS, 
  MOULDS_BY_CATEGORY, 
  GOOGLE_FONTS 
} from '@/lib/shapes';

import TraceFrameCreator from '@/components/TraceFrameCreator';

// A4 sizing standard in px at 96 DPI
// 210mm x 297mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MM_TO_PX_RATIO = 3.7795275591; // 1mm in pixels at 96 DPI

let globalIdCounter = 0;
function generateUniqueId(): string {
  globalIdCounter += 1;
  return `el-${Date.now()}-${globalIdCounter}`;
}

export default function ResinaDesignWorkspace() {
  const [isMounted, setIsMounted] = React.useState<boolean>(false);

  // 1. STATE & AUTHENTICATION
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [emailInput, setEmailInput] = React.useState<string>('www.rodrigolisboa@gmail.com');
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [activeProject, setActiveProject] = React.useState<Project | null>(null);
  const [activeElementId, setActiveElementId] = React.useState<string | null>(null);

  // Editor states
  const [activeTab, setActiveTab] = React.useState<'moldes' | 'upload' | 'texto' | 'meus'>('moldes');
  const [currentCategory, setCurrentCategory] = React.useState<string>('letras');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [zoom, setZoom] = React.useState<number>(85); // % zoom
  const [showGrid, setShowGrid] = React.useState<boolean>(true);
  const [showRuler, setShowRuler] = React.useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = React.useState<boolean>(false);
  const gridSpacingMm = 5; // 5mm grid intervals
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState<boolean>(false);
  const [selectedStylizedFont, setSelectedStylizedFont] = React.useState<string>('Bungee');

  // Global upload repository (base64)
  const [uploadedImages, setUploadedImages] = React.useState<string[]>([]);
  const [customFrames, setCustomFrames] = React.useState<{ id: string; name: string; maskSrc: string }[]>([]);

  // Hydration & localStorage loader on mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      
      const cachedEmail = localStorage.getItem('resina_design_logged_email');
      if (cachedEmail) {
        setUserEmail(cachedEmail);
        setEmailInput(cachedEmail);
        try {
          const allProjectsRaw = localStorage.getItem('resina_design_projects_v1');
          const allProjects: Project[] = allProjectsRaw ? JSON.parse(allProjectsRaw) : [];
          const userProjects = allProjects.filter(p => p.userEmail.toLowerCase() === cachedEmail.toLowerCase());
          
          // Migrate legacy projects to the new multi-sheet structure
          const migrated = userProjects.map(p => {
            if (!p.sheets || p.sheets.length === 0) {
              return {
                ...p,
                sheets: [
                  { id: 'sheet-main', name: 'Folha 1', elements: p.elements || [] }
                ],
                activeSheetId: 'sheet-main'
              };
            }
            return p;
          });
          setProjects(migrated);
        } catch (e) {
          console.error(e);
        }
      }

      const cachedImages = localStorage.getItem('resina_design_user_images');
      if (cachedImages) {
        try {
          setUploadedImages(JSON.parse(cachedImages));
        } catch (e) {
          console.error(e);
        }
      } else {
        setUploadedImages([
          'https://picsum.photos/seed/vintage/300/300',
          'https://picsum.photos/seed/flowers/300/300'
        ]);
      }

      const cachedFrames = localStorage.getItem('resina_design_custom_frames');
      if (cachedFrames) {
        try {
          setCustomFrames(JSON.parse(cachedFrames));
        } catch (e) {
          console.error(e);
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Text inputs
  const [newText, setNewText] = React.useState<string>('Resina');

  // Interactive undo/redo stacks
  const [undoStack, setUndoStack] = React.useState<SheetElement[][]>([]);
  const [redoStack, setRedoStack] = React.useState<SheetElement[][]>([]);

  // Mouse drag control state
  const [dragState, setDragState] = React.useState<{
    elementId: string;
    startX: number;
    startY: number;
    startElemX: number;
    startElemY: number;
    type: 'translate' | 'resize-se' | 'resize-e' | 'resize-s' | 'image-pan';
    startWidth?: number;
    startHeight?: number;
    startImageX?: number;
    startImageY?: number;
  } | null>(null);

  // Status message notification
  const [toastMessage, setToastMessage] = React.useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Reference for the printable container
  const a4SheetRef = React.useRef<HTMLDivElement | null>(null);

  const loadProjectsForEmail = (email: string) => {
    try {
      const allProjectsRaw = localStorage.getItem('resina_design_projects_v1');
      const allProjects: Project[] = allProjectsRaw ? JSON.parse(allProjectsRaw) : [];
      const userProjects = allProjects.filter(p => p.userEmail.toLowerCase() === email.toLowerCase());
      
      // Migrate legacy projects to the new multi-sheet structure
      const migrated = userProjects.map(p => {
        if (!p.sheets || p.sheets.length === 0) {
          return {
            ...p,
            sheets: [
              { id: 'sheet-main', name: 'Folha 1', elements: p.elements || [] }
            ],
            activeSheetId: 'sheet-main'
          };
        }
        return p;
      });

      setProjects(migrated);
    } catch (e) {
      console.error("Erro ao carregar projetos", e);
    }
  };

  const saveAllProjectsToLocalStorage = (userEmailAddr: string, updatedList: Project[]) => {
    try {
      const allProjectsRaw = localStorage.getItem('resina_design_projects_v1');
      let allProjects: Project[] = allProjectsRaw ? JSON.parse(allProjectsRaw) : [];
      
      // Migrate global storage elements as well
      const migratedGlobal = allProjects.map(p => {
        if (p.userEmail.toLowerCase() === userEmailAddr.toLowerCase()) {
          const matchInUpdated = updatedList.find(ul => ul.id === p.id);
          if (matchInUpdated) return matchInUpdated;
        }
        if (!p.sheets || p.sheets.length === 0) {
          return {
            ...p,
            sheets: [
              { id: 'sheet-main', name: 'Folha 1', elements: p.elements || [] }
            ],
            activeSheetId: 'sheet-main'
          };
        }
        return p;
      });

      // Filter out current user's projects and add newly updated ones
      let filtered = migratedGlobal.filter(p => p.userEmail.toLowerCase() !== userEmailAddr.toLowerCase());
      filtered = [...filtered, ...updatedList];
      
      localStorage.setItem('resina_design_projects_v1', JSON.stringify(filtered));
    } catch (e) {
      console.error("Erro ao salvar no cache global", e);
    }
  };

  // 2. TOAST TRIGGERS
  const triggerToast = (text: string, type: 'success' | 'warn' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 3. HANDLERS (LOGIN & LOGOUT)
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      triggerToast('Por favor, digite um e-mail válido.', 'warn');
      return;
    }
    localStorage.setItem('resina_design_logged_email', emailInput);
    setUserEmail(emailInput);
    loadProjectsForEmail(emailInput);
    triggerToast('Bem-vindo(a)! Sessão iniciada com sucesso.', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('resina_design_logged_email');
    setUserEmail(null);
    setActiveProject(null);
    setActiveElementId(null);
    setProjects([]);
    triggerToast('Sessão encerrada.', 'success');
  };

  // 4. PROJECT CRUD
  const createNewProject = () => {
    if (!userEmail) return;

    const sheet1: ProjectSheet = {
      id: 'sheet-blank',
      name: 'Folha em Branco',
      elements: []
    };
    
    const sheet2: ProjectSheet = {
      id: 'sheet-alphabet',
      name: 'Alfabeto Completo (A-Z)',
      elements: generateAlphabetSheetElements()
    };

    const newProj: Project = {
      id: `proj-${Date.now()}`,
      userEmail: userEmail,
      name: `Novo Projeto - ${new Date().toLocaleDateString('pt-BR')}`,
      updatedAt: new Date().toISOString(),
      elements: [], // blank canvas initially
      sheets: [sheet1, sheet2],
      activeSheetId: 'sheet-blank'
    };

    const updated = [newProj, ...projects];
    setProjects(updated);
    saveAllProjectsToLocalStorage(userEmail, updated);
    setActiveProject(newProj);
    setActiveElementId(null);
    setUndoStack([]);
    setRedoStack([]);
    triggerToast('Novo projeto criado com Abas!');
  };

  const openProject = (p: Project) => {
    setActiveProject(p);
    setActiveElementId(null);
    setUndoStack([]);
    setRedoStack([]);
    triggerToast(`Projeto "${p.name}" carregado.`);
  };

  const duplicateProject = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userEmail) return;
    const copied: Project = {
      ...proj,
      id: `proj-${Date.now()}`,
      name: `${proj.name} (Cópia)`,
      updatedAt: new Date().toISOString(),
      elements: proj.elements.map(el => ({ ...el, id: generateUniqueId() }))
    };
    
    const updated = [copied, ...projects];
    setProjects(updated);
    saveAllProjectsToLocalStorage(userEmail, updated);
    triggerToast('Projeto duplicado!');
  };

  const deleteProject = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userEmail) return;
    if (confirm('Tem certeza que deseja excluir este projeto permanentemente?')) {
      const updated = projects.filter(p => p.id !== projId);
      setProjects(updated);
      saveAllProjectsToLocalStorage(userEmail, updated);
      if (activeProject && activeProject.id === projId) {
        setActiveProject(null);
        setActiveElementId(null);
      }
      triggerToast('Projeto removido.');
    }
  };

  const updateCurrentProjectElements = (newElements: SheetElement[]) => {
    if (!activeProject || !userEmail) return;
    
    // Save history
    setUndoStack(prev => [...prev, activeProject.elements]);
    setRedoStack([]); // Clear redo stack on action

    // If sheets doesn't exist, initialize
    let updatedSheets = activeProject.sheets ? [...activeProject.sheets] : [
      { id: 'sheet-main', name: 'Folha 1', elements: activeProject.elements || [] }
    ];
    let activeId = activeProject.activeSheetId || 'sheet-main';

    updatedSheets = updatedSheets.map(s => {
      if (s.id === activeId) {
        return { ...s, elements: newElements };
      }
      return s;
    });

    const updatedProj = {
      ...activeProject,
      elements: newElements, // Keep elements in sync for legacy code
      sheets: updatedSheets,
      activeSheetId: activeId,
      updatedAt: new Date().toISOString()
    };

    setActiveProject(updatedProj);

    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
  };

  // MULTI-SHEET SHEETS (TABS) CONTROLS
  const handleSwitchSheet = (sheetId: string) => {
    if (!activeProject || !userEmail) return;
    
    // Ensure sheets is initialized
    let sheets = activeProject.sheets ? [...activeProject.sheets] : [
      { id: 'sheet-main', name: 'Folha 1', elements: activeProject.elements || [] }
    ];

    const targetSheet = sheets.find(s => s.id === sheetId) || sheets[0];
    
    const updatedProj: Project = {
      ...activeProject,
      sheets,
      activeSheetId: targetSheet.id,
      elements: targetSheet.elements || [], // Sync active elements for legacy
      updatedAt: new Date().toISOString()
    };

    setActiveElementId(null);
    setUndoStack([]);
    setRedoStack([]);
    setActiveProject(updatedProj);

    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
    triggerToast(`Aba "${targetSheet.name}" ativa!`);
  };

  const handleAddNewSheet = () => {
    if (!activeProject || !userEmail) return;

    let sheets = activeProject.sheets ? [...activeProject.sheets] : [
      { id: 'sheet-main', name: 'Folha 1', elements: activeProject.elements || [] }
    ];

    const newSheetId = `sheet-${Date.now()}`;
    const newSheetName = `Folha ${sheets.length + 1}`;
    
    const newSheet: ProjectSheet = {
      id: newSheetId,
      name: newSheetName,
      elements: []
    };

    const finalSheets = [...sheets, newSheet];

    const updatedProj: Project = {
      ...activeProject,
      sheets: finalSheets,
      activeSheetId: newSheetId,
      elements: [], // Clear canvas elements for the new blank sheet
      updatedAt: new Date().toISOString()
    };

    setActiveElementId(null);
    setUndoStack([]);
    setRedoStack([]);
    setActiveProject(updatedProj);

    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
    triggerToast(`Nova "${newSheetName}" criada!`);
  };

  const handleDeleteSheet = (sheetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProject || !userEmail) return;

    let sheets = activeProject.sheets ? [...activeProject.sheets] : [
      { id: 'sheet-main', name: 'Folha 1', elements: activeProject.elements || [] }
    ];

    if (sheets.length <= 1) {
      triggerToast('O projeto precisa ter pelo menos uma aba/folha!', 'warn');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta aba/folha com todos os seus moldes?')) {
      return;
    }

    const filteredSheets = sheets.filter(s => s.id !== sheetId);
    // Determine new active sheet id if we are deleting currently selected sheet
    const activeId = activeProject.activeSheetId === sheetId ? filteredSheets[0].id : activeProject.activeSheetId;
    const activeSheet = filteredSheets.find(s => s.id === activeId) || filteredSheets[0];

    const updatedProj: Project = {
      ...activeProject,
      sheets: filteredSheets,
      activeSheetId: activeId,
      elements: activeSheet.elements || [],
      updatedAt: new Date().toISOString()
    };

    setActiveElementId(null);
    setUndoStack([]);
    setRedoStack([]);
    setActiveProject(updatedProj);

    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
    triggerToast('Aba removida com sucesso.');
  };

  const handleRenameSheet = (sheetId: string, newName: string) => {
    if (!activeProject || !userEmail || !newName.trim()) return;

    let sheets = activeProject.sheets ? [...activeProject.sheets] : [
      { id: 'sheet-main', name: 'Folha 1', elements: activeProject.elements || [] }
    ];

    const updatedSheets = sheets.map(s => s.id === sheetId ? { ...s, name: newName } : s);

    const updatedProj: Project = {
      ...activeProject,
      sheets: updatedSheets,
      updatedAt: new Date().toISOString()
    };

    setActiveProject(updatedProj);
    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
  };

  // 5. UNDO & REDO
  const handleUndo = () => {
    if (!activeProject || undoStack.length === 0 || !userEmail) return;
    const previous = undoStack[undoStack.length - 1];
    const current = activeProject.elements;

    setRedoStack(prev => [...prev, current]);
    setUndoStack(prev => prev.slice(0, prev.length - 1));

    const updatedProj = { ...activeProject, elements: previous };
    setActiveProject(updatedProj);

    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
  };

  const handleRedo = () => {
    if (!activeProject || redoStack.length === 0 || !userEmail) return;
    const next = redoStack[redoStack.length - 1];
    const current = activeProject.elements;

    setUndoStack(prev => [...prev, current]);
    setRedoStack(prev => prev.slice(0, prev.length - 1));

    const updatedProj = { ...activeProject, elements: next };
    setActiveProject(updatedProj);

    const updatedProjectsList = projects.map(p => p.id === activeProject.id ? updatedProj : p);
    setProjects(updatedProjectsList);
    saveAllProjectsToLocalStorage(userEmail, updatedProjectsList);
  };

  // 6. ELEMENT OPERATIONS
  const addMoldToSheet = (shapeId: string, customSize?: { w: number; h: number }, customMask?: string, fontFamilyOverride?: string) => {
    if (!activeProject) return;

    // Determine default details
    let name = 'Mould';
    let iconShape = 'circle';
    let w = 40;
    let h = 40;

    if (customMask) {
      name = shapeId;
      w = 50;
      h = 50;
    } else if (shapeId.startsWith('l_est-')) {
      name = `Letra Estilizada - ${shapeId.substring(6)}`;
      iconShape = `text:${shapeId.substring(6)}`;
      w = customSize?.w || 40;
      h = customSize?.h || 45;
    } else {
      // Find mould template details
      const flatMolds = Object.values(MOULDS_BY_CATEGORY).flat();
      const template = flatMolds.find(m => m.id === shapeId);
      if (template) {
        name = template.name;
        iconShape = template.iconShape;
        w = customSize?.w || template.defaultWidth;
        h = customSize?.h || template.defaultHeight;
      }
    }

    // Assign safe initial index
    const highZ = activeProject.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0) + 1;

    const newElement: SheetElement = {
      id: generateUniqueId(),
      type: shapeId.startsWith('letter-') || shapeId.startsWith('number-') || shapeId.startsWith('l_est-') ? 'text-mask' : 'shape',
      name,
      x: 20, // margins in mm
      y: 20,
      width: w,
      height: h,
      rotation: 0,
      isLocked: false,
      zIndex: highZ,
      fillColor: '#e2e8f0',
      strokeColor: '#3b82f6',
      strokeWidth: 0.8,
      ringHole: true,
      isMirroredH: false,
      isMirroredV: false,
      shapeType: customMask ? undefined : (shapeId.startsWith('l_est-') ? undefined : shapeId),
      customMaskSrc: customMask,
      imageScale: 1.2,
      imageX: 0,
      imageY: 0,
      imageRotation: 0,
      imageFlipH: false,
      imageFlipV: false,
      text: shapeId.startsWith('letter-') || shapeId.startsWith('number-') || shapeId.startsWith('l_est-') ? (
        shapeId.startsWith('l_est-') ? shapeId.substring(6) : shapeId.substring(7)
      ) : undefined,
      fontFamily: fontFamilyOverride || 'Arial Black',
      fontSize: 32
    };

    updateCurrentProjectElements([...activeProject.elements, newElement]);
    setActiveElementId(newElement.id);
    triggerToast(`Mould "${name}" adicionado à folha.`);
  };

  const addTextElement = () => {
    if (!activeProject) return;
    const highZ = activeProject.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0) + 1;

    const newElement: SheetElement = {
      id: generateUniqueId(),
      type: 'text',
      name: `Texto: ${newText}`,
      x: 30,
      y: 50,
      width: 70,
      height: 24,
      rotation: 0,
      isLocked: false,
      zIndex: highZ,
      fillColor: 'transparent',
      strokeColor: 'transparent',
      strokeWidth: 0,
      ringHole: false,
      isMirroredH: false,
      isMirroredV: false,
      imageScale: 1.0,
      imageX: 0,
      imageY: 0,
      imageRotation: 0,
      imageFlipH: false,
      imageFlipV: false,
      text: newText,
      fontFamily: 'Outfit',
      fontSize: 12, // in mm
      textColor: '#ffffff',
      textBold: true,
      textItalic: false,
      textAlignment: 'center',
      isCurved: false,
      curveRadius: 40,
      curveDirection: 'up',
      letterSpacing: 0
    };

    updateCurrentProjectElements([...activeProject.elements, newElement]);
    setActiveElementId(newElement.id);
    triggerToast('Elemento de texto inserido.');
  };

  const duplicateSelectedElement = () => {
    if (!activeProject || !activeElementId) return;
    const target = activeProject.elements.find(el => el.id === activeElementId);
    if (!target) return;

    const highZ = activeProject.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0) + 1;
    const duplicated: SheetElement = {
      ...target,
      id: generateUniqueId(),
      name: `${target.name} (Cópia)`,
      x: target.x + 8, // slight offset MM displacement
      y: target.y + 8,
      zIndex: highZ,
      isLocked: false
    };

    updateCurrentProjectElements([...activeProject.elements, duplicated]);
    setActiveElementId(duplicated.id);
    triggerToast('Molde duplicado.');
  };

  const deleteSelectedElement = () => {
    if (!activeProject || !activeElementId) return;
    const updated = activeProject.elements.filter(el => el.id !== activeElementId);
    updateCurrentProjectElements(updated);
    setActiveElementId(null);
    triggerToast('Elemento removido.');
  };

  const handleUpdateElementProps = (props: Partial<SheetElement>) => {
    if (!activeProject || !activeElementId) return;
    const updated = activeProject.elements.map(el => {
      if (el.id === activeElementId) {
        return { ...el, ...props };
      }
      return el;
    });
    updateCurrentProjectElements(updated);
  };

  // 7. KEYBOARD SHORTCUTS
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeProject) return;

      // Ignore if user is editing inputs/textareas
      const focused = document.activeElement?.tagName;
      if (focused === 'INPUT' || focused === 'TEXTAREA' || focused === 'SELECT') {
        return;
      }

      const isMac = navigator.userAgent.indexOf('Mac') !== -1;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (ctrlKey && e.key.toLowerCase() === 'c') {
        // Copy standard
        if (activeElementId) {
          e.preventDefault();
          localStorage.setItem('resina_design_clipboard', JSON.stringify(
            activeProject.elements.find(el => el.id === activeElementId)
          ));
          triggerToast('Item copiado!');
        }
      } else if (ctrlKey && e.key.toLowerCase() === 'v') {
        // Paste standard
        e.preventDefault();
        const clipboardRaw = localStorage.getItem('resina_design_clipboard');
        if (clipboardRaw) {
          try {
            const parsed: SheetElement = JSON.parse(clipboardRaw);
            const highZ = activeProject.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0) + 1;
            const pasted: SheetElement = {
              ...parsed,
              id: generateUniqueId(),
              name: `${parsed.name} (Cola)`,
              x: parsed.x + 10,
              y: parsed.y + 10,
              zIndex: highZ,
              isLocked: false
            };
            updateCurrentProjectElements([...activeProject.elements, pasted]);
            setActiveElementId(pasted.id);
            triggerToast('Item colado!');
          } catch (err) {}
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeElementId) {
          e.preventDefault();
          deleteSelectedElement();
        }
      } else if (ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerToast('Projeto salvo em cache local.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProject, activeElementId, undoStack, redoStack]);

  // 8. INTERACTIVE DRAG & RESIZE ENGINE
  const handleSheetMouseDown = (e: React.MouseEvent) => {
    // Left-clicking on back is select non
    if (e.target === e.currentTarget) {
      setActiveElementId(null);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, element: SheetElement, handleType: 'translate' | 'resize-se' | 'resize-e' | 'resize-s' | 'image-pan') => {
    e.stopPropagation();
    if (element.isLocked && handleType !== 'image-pan') return;

    setActiveElementId(element.id);
    
    // Store current values for reference relative displacement
    setDragState({
      elementId: element.id,
      startX: e.clientX,
      startY: e.clientY,
      startElemX: element.x,
      startElemY: element.y,
      startWidth: element.width,
      startHeight: element.height,
      startImageX: element.imageX,
      startImageY: element.imageY,
      type: handleType
    });
  };

  // Touch triggers for mobile optimization
  const handleElementTouchStart = (e: React.TouchEvent, element: SheetElement, handleType: 'translate' | 'resize-se' | 'resize-e' | 'resize-s' | 'image-pan') => {
    e.stopPropagation();
    if (element.isLocked && handleType !== 'image-pan') return;

    setActiveElementId(element.id);
    const touch = e.touches[0];
    setDragState({
      elementId: element.id,
      startX: touch.clientX,
      startY: touch.clientY,
      startElemX: element.x,
      startElemY: element.y,
      startWidth: element.width,
      startHeight: element.height,
      startImageX: element.imageX,
      startImageY: element.imageY,
      type: handleType
    });
  };

  React.useEffect(() => {
    const handleGlobalMove = (clientX: number, clientY: number) => {
      if (!dragState || !activeProject) return;

      const element = activeProject.elements.find(el => el.id === dragState.elementId);
      if (!element) return;

      // Real screen scale to mm conversion factor based on our zoom
      const canvasEl = document.getElementById('a4-printable-stage');
      if (!canvasEl) return;
      const bounds = canvasEl.getBoundingClientRect();
      
      const pxToMmX = A4_WIDTH_MM / bounds.width;
      const pxToMmY = A4_HEIGHT_MM / bounds.height;

      const deltaX = (clientX - dragState.startX) * pxToMmX;
      const deltaY = (clientY - dragState.startY) * pxToMmY;

      let nextProps: Partial<SheetElement> = {};

      if (dragState.type === 'translate') {
        let nextX = dragState.startElemX + deltaX;
        let nextY = dragState.startElemY + deltaY;

        if (snapToGrid) {
          nextX = Math.round(nextX / gridSpacingMm) * gridSpacingMm;
          nextY = Math.round(nextY / gridSpacingMm) * gridSpacingMm;
        }

        nextProps = { x: nextX, y: nextY };
      } else if (dragState.type === 'resize-se') {
        // Resize bottom-right diagonal proportional
        const nextW = Math.max(8, (dragState.startWidth || 10) + deltaX);
        const nextH = Math.max(8, (dragState.startHeight || 10) + deltaY);
        nextProps = { width: nextW, height: nextH };
      } else if (dragState.type === 'resize-e') {
        // Horizontal stretch (checks compress requests)
        const nextW = Math.max(8, (dragState.startWidth || 10) + deltaX);
        nextProps = { width: nextW };
      } else if (dragState.type === 'resize-s') {
        // Vertical stretch
        const nextH = Math.max(8, (dragState.startHeight || 10) + deltaY);
        nextProps = { height: nextH };
      } else if (dragState.type === 'image-pan') {
        // Drag photo around inside the frame (never exits mask)
        const nextImgX = (dragState.startImageX || 0) + deltaX;
        const nextImgY = (dragState.startImageY || 0) + deltaY;
        nextProps = { imageX: nextImgX, imageY: nextImgY };
      }

      // Update values in database
      const updatedList = activeProject.elements.map(el => {
        if (el.id === dragState.elementId) {
          return { ...el, ...nextProps };
        }
        return el;
      });

      // Simple update without intermediate history to keep it performant
      const updatedProj = { ...activeProject, elements: updatedList };
      setActiveProject(updatedProj);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      e.preventDefault();
      handleGlobalMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragState) return;
      handleGlobalMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleGlobalUp = () => {
      if (dragState && activeProject) {
        // Commit drag actions formally with undo history preservation
        const finalElements = activeProject.elements;
        setDragState(null);
        updateCurrentProjectElements(finalElements);
      }
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchend', handleGlobalUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [dragState, activeProject, snapToGrid]);

  // 9. PHOTO DRAG-OVER-MOLD INSERTER
  // Drop uploaded image inside standard mould frame
  const handleDropImageOnMould = (imgUrl: string, elementId: string) => {
    const updated = activeProject?.elements.map(el => {
      if (el.id === elementId) {
        return { 
          ...el, 
          imageSrc: imgUrl, 
          imageScale: 1.2, 
          imageX: 0, 
          imageY: 0,
          imageRotation: 0
        };
      }
      return el;
    });
    if (updated) {
      updateCurrentProjectElements(updated);
      triggerToast('Imagem colocada dentro do molde!');
    }
  };

  // Convert custom uploaded image file
  const handleUploadImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64Src = event.target.result as string;
          const updated = [base64Src, ...uploadedImages];
          setUploadedImages(updated);
          localStorage.setItem('resina_design_user_images', JSON.stringify(updated));
          triggerToast('Nova imagem importada.');
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const deleteUploadedImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = uploadedImages.filter((_, idx) => idx !== index);
    setUploadedImages(updated);
    localStorage.setItem('resina_design_user_images', JSON.stringify(updated));
    triggerToast('Imagem excluída dos uploads.');
  };

  // Custom SVG outline parsing/import
  const handleImportMouldSVG = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileObj = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const svgText = event.target?.result as string;
        // Attempt search for paths
        const match = svgText.match(/d="([^"]+)"/);
        if (match && match[1]) {
          const pathValue = match[1];
          const newId = `imported-${Date.now()}`;
          // Generate customized icon base64 for frame insertion
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%23e2e8f0" stroke="%233b82f6"><path d="${pathValue}" /></svg>`;
          const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
          
          const newFrame = { id: newId, name: fileObj.name.replace('.svg', ''), maskSrc: encoded };
          const updated = [newFrame, ...customFrames];
          setCustomFrames(updated);
          localStorage.setItem('resina_design_custom_frames', JSON.stringify(updated));
          triggerToast('Molde vetorial SVG importado!');
        } else {
          // If pure path extraction fails, treat as a transparent png frame
          triggerToast('SVG complexo. Salvo como frame visual transparente.', 'warn');
        }
      };
      reader.readAsText(fileObj);
    }
  };

  // 10. REAL PRINT SCALE & PDF RENDERERS
  // Print preview configuration triggers
  const handlePrintRequest = () => {
    setActiveElementId(null); // Deselect to hide wireframe handles in print
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleGeneratePDF = async () => {
    const originalZoom = zoom;
    setActiveElementId(null); // Clear active highlight borders
    setZoom(100); // Lock zoom at 100% for pixel perfect scale snapshot

    triggerToast('Iniciando conversão para PDF de Alta Qualidade (A4)... Aguarde.');
    
    setTimeout(async () => {
      const stage = document.getElementById('a4-printable-stage');
      if (!stage) {
        setZoom(originalZoom);
        return;
      }

      try {
        // High density export: capture at 3x scale for professional printing readability
        const canvas = await html2canvas(stage, {
          scale: 3, 
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Define exact A4 portrait dimensions
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
        pdf.save(`${activeProject?.name || 'Projeto_Resina'}.pdf`);
        
        triggerToast('PDF exportado com sucesso em tamanho real!');
      } catch (err) {
        console.error(err);
        triggerToast('Falha ao exportar PDF.', 'warn');
      } finally {
        setZoom(originalZoom);
      }
    }, 800);
  };

  // Helper calculation to draw dynamic SVG curves for letters & text arcs
  const getCurvePath = (element: SheetElement) => {
    const r = element.curveRadius || 40;
    const isUp = element.curveDirection === 'up';
    const w = element.width;
    const h = element.height;
    
    if (isUp) {
      // Arched up path anchor
      return `M 5,${h * 0.8} Q ${w/2},${h * 0.1} ${w - 5},${h * 0.8}`;
    } else {
      // Sloped drooped down path
      return `M 5,${h * 0.2} Q ${w/2},${h * 0.9} ${w - 5},${h * 0.2}`;
    }
  };

  // Vector render maps
  const renderShapeBody = (element: SheetElement) => {
    const isCustom = !!element.customMaskSrc;
    
    // Check if shape path exists
    let rawPath = SHAPE_PATHS[element.shapeType || ''] || SHAPE_PATHS.circle;
    
    return (
      <svg 
        viewBox="0 0 100 100" 
        width="100%" 
        height="100%" 
        preserveAspectRatio="none"
        className="absolute inset-0"
        style={{
          transform: `scale(${element.isMirroredH ? -1 : 1}, ${element.isMirroredV ? -1 : 1})`,
        }}
      >
        <defs>
          <clipPath id={`clip-${element.id}`}>
            {isCustom ? (
              // Use cover polygon for rect masks with image-to-frame silhouettes
              <rect width="100" height="100" />
            ) : element.type === 'text-mask' ? (
              // Dynamic Text Mask (Letra / Número)
              <text 
                x="50" 
                y="78" 
                fontSize="76" 
                fontWeight="900" 
                style={{ fontFamily: element.fontFamily || 'Arial Black' }}
                textAnchor="middle"
              >
                {element.text}
              </text>
            ) : (
              // Normal categorized mold vectors
              <g dangerouslySetInnerHTML={{ __html: rawPath }} />
            )}
          </clipPath>

          <linearGradient id={`sky-grad-${element.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="60%" stopColor="#f0f9ff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <pattern id={`landscape-${element.id}`} width="100" height="100" patternUnits="userSpaceOnUse">
            {/* Soft sky skybg */}
            <rect width="100" height="100" fill={`url(#sky-grad-${element.id})`} />
            {/* Golden glowing sun representing nature */}
            <circle cx="50" cy="40" r="9" fill="#fef08a" opacity="0.6" />
            {/* Stylized landscape cloud representations */}
            <circle cx="32" cy="38" r="11" fill="#ffffff" opacity="0.85" />
            <circle cx="44" cy="40" r="9" fill="#ffffff" opacity="0.85" />
            <circle cx="68" cy="36" r="14" fill="#ffffff" opacity="0.85" />
            <circle cx="78" cy="40" r="10" fill="#ffffff" opacity="0.85" />
            {/* Background pastures */}
            <path d="M -10,78 Q 25,64 60,74 T 110,78 L 110,105 L -10,105 Z" fill="#d9f99d" />
            {/* Foreground pastures */}
            <path d="M -10,86 Q 35,76 75,86 T 110,86 L 110,105 L -10,105 Z" fill="#a3e635" />
          </pattern>
        </defs>

        {/* Backdrop plain color filling */}
        {!element.imageSrc && (
          <g>
            {element.type === 'text-mask' ? (
              <text 
                x="50" 
                y="78" 
                fontSize="76" 
                fontWeight="900" 
                style={{ fontFamily: element.fontFamily || 'Arial Black' }}
                textAnchor="middle"
                fill={(!element.fillColor || element.fillColor === '#ffffff' || element.fillColor === '#f1f5f9' || element.fillColor === '#fff') ? `url(#landscape-${element.id})` : element.fillColor}
              >
                {element.text}
              </text>
            ) : (
              <g 
                dangerouslySetInnerHTML={{ __html: rawPath }} 
                fill={(!element.fillColor || element.fillColor === '#ffffff' || element.fillColor === '#f1f5f9' || element.fillColor === '#fff') ? `url(#landscape-${element.id})` : element.fillColor} 
              />
            )}
          </g>
        )}

        {/* Clipped photo rendering with custom offsets */}
        {element.imageSrc && (
          <g clipPath={`url(#clip-${element.id})`}>
            {/* Direct CSS masked layout representing tracing frame markers */}
            <image 
              href={element.imageSrc} 
              x={50 - (50 * element.imageScale) + (element.imageX * MM_TO_PX_RATIO)} 
              y={50 - (50 * element.imageScale) + (element.imageY * MM_TO_PX_RATIO)} 
              width={100 * element.imageScale} 
              height={100 * element.imageScale} 
              preserveAspectRatio="xMidYMid slice"
              transform={`
                rotate(${element.imageRotation}, 50, 50)
                scale(${element.imageFlipH ? -1 : 1}, ${element.imageFlipV ? -1 : 1})
              `}
              style={{
                transformOrigin: '50% 50%',
              }}
            />
          </g>
        )}

        {/* Fine screen outline to assist seeing empty shape boundaries */}
        <g className="hide-on-print" opacity="0.6">
          {element.type === 'text-mask' ? (
            <text 
              x="50" 
              y="78" 
              fontSize="76" 
              fontWeight="900" 
              style={{ fontFamily: element.fontFamily || 'Arial Black' }}
              textAnchor="middle"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="0.8"
            >
              {element.text}
            </text>
          ) : (
            <g 
              dangerouslySetInnerHTML={{ __html: rawPath }} 
              fill="none" 
              stroke="#94a3b8" 
              strokeWidth="0.8" 
            />
          )}
        </g>

        {/* Exterior border outline printing guide */}
        {!isCustom && element.strokeWidth > 0 && (
          <g>
            {element.type === 'text-mask' ? (
              <text 
                x="50" 
                y="78" 
                fontSize="76" 
                fontWeight="900" 
                style={{ fontFamily: element.fontFamily || 'Arial Black' }}
                textAnchor="middle"
                fill="none"
                stroke={element.strokeColor}
                strokeWidth={element.strokeWidth * 2.5}
              >
                {element.text}
              </text>
            ) : (
              <g dangerouslySetInnerHTML={{ __html: rawPath }} fill="none" stroke={element.strokeColor} strokeWidth={element.strokeWidth * 2.5} />
            )}
          </g>
        )}

        {/* Punch key hole overlay indicator to prevent text overlays */}
        {element.ringHole && (
          <circle cx="50" cy="14" r="3.5" fill="#1e1f22" stroke={element.strokeColor} strokeWidth="1" />
        )}
      </svg>
    );
  };

  // CHECK IF MOUNTED TO PREVENT HYDRATION MISMATCH
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#007fff] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-gray-400">Carregando Atelier...</p>
        </div>
      </div>
    );
  }

  // CHECK IF EMAIL LOGGED
  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#2b2d31] border border-[#3f4147] rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#007fff]/15 rounded-full flex items-center justify-center mx-auto text-[#007fff] border border-[#007fff]/25">
              <Hammer className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white font-display">Resina Design</h1>
            <p className="text-gray-400 text-xs leading-relaxed max-w-sm mx-auto">
              Plataforma livre e gratuita para criação de desenhos e chaveiros de resina em escala real de impressão A4.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-300 font-semibold mb-1.5 text-xs block">Endereço de E-mail</label>
              <input 
                type="email" 
                required
                value={emailInput} 
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="exemplo@gmail.com" 
                className="w-full text-sm bg-[#1e1f22] border border-[#3f4147] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#007fff] focus:ring-1 focus:ring-[#007fff]/30 transition"
              />
              <span className="text-[10px] text-gray-400 mt-2 block leading-relaxed">
                * Não é necessário senha. Seus projetos serão salvos vinculados no navegador a este e-mail.
              </span>
            </div>

            <button
              type="submit"
              className="w-full text-sm font-bold bg-[#007fff] hover:bg-blue-600 transition text-white py-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Entrar no Atelier
            </button>
          </form>

          <div className="border-t border-[#3f4147] pt-4 text-center">
            <span className="text-[10px] text-gray-500 block">Resina Design Studio v1.5 • 100% Gratuito</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ACTIVE PROJECTS SELECTOR (DASHBOARD)
  if (!activeProject) {
    return (
      <div className="min-h-screen bg-[#1e1f22] text-white flex flex-col">
        {/* Navigation */}
        <header className="bg-[#2b2d31] border-b border-[#3f4147] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#007fff] rounded-lg flex items-center justify-center text-white font-black text-lg">R</div>
            <div>
              <h1 className="text-md font-extrabold tracking-tight">Resina Design</h1>
              <span className="text-[10px] text-gray-400 block -mt-1 font-mono">Painel de Criação</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <span className="text-gray-400 text-[10px] block">Atelier Autenticado</span>
              <span className="text-xs text-white font-mono font-medium">{userEmail}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="px-3 py-1.5 rounded bg-transparent hover:bg-rose-500/10 border border-gray-600 hover:border-rose-500 text-gray-300 hover:text-rose-500 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </header>

        {/* Dashboard Grid list */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-display text-white">Meus Projetos Arquivados</h2>
              <p className="text-xs text-gray-400 mt-1">Selecione um projeto salvo neste navegador ou inicie um novo molde A4 do zero.</p>
            </div>

            <button
              onClick={createNewProject}
              className="bg-[#007fff] hover:bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
            >
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="border border-dashed border-[#3f4147] bg-[#2b2d31]/40 rounded-xl p-12 text-center space-y-4">
              <div className="w-12 h-12 bg-white/5 mx-auto rounded-full flex items-center justify-center text-gray-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-200">Nenhum projeto registrado neste workspace</p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Utilize nosso painel para criar gabaritos de chaveiros de letras, moldes de canetas ou plaquetas e exportá-los em PDF de alta qualidade.
                </p>
              </div>
              <button 
                onClick={createNewProject}
                className="py-2 px-4 rounded bg-[#007fff] text-white text-xs font-bold hover:bg-blue-600 transition"
              >
                Criar Primeiro Molde
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => (
                <div 
                  key={p.id}
                  onClick={() => openProject(p)}
                  className="bg-[#2b2d31] border border-[#3f4147] rounded-xl hover:border-[#007fff]/50 p-5 space-y-4 cursor-pointer transition-all group"
                >
                  <div className="w-full aspect-[4/5] bg-white rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden group-hover:scale-[1.01] transition-all">
                    {/* Visual miniature elements layout list */}
                    <div className="absolute inset-0 p-3 scale-[0.6] opacity-75 origin-top-left pointer-events-none">
                      {p.elements.slice(0, 3).map((el, i) => (
                        <div 
                          key={i}
                          className="absolute border border-[#007fff]/30 bg-[#007fff]/5 rounded text-[8px] flex items-center justify-center"
                          style={{
                            left: `${el.x}mm`,
                            top: `${el.y}mm`,
                            width: `${el.width}mm`,
                            height: `${el.height}mm`,
                          }}
                        >
                          {el.name}
                        </div>
                      ))}
                    </div>
                    
                    <FileSpreadsheet className="w-10 h-10 text-gray-300" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-100 group-hover:text-[#007fff] transition-all duration-300 truncate">{p.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                      <span>Atualizado em:</span>
                      <span>{new Date(p.updatedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#3f4147]/50" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openProject(p)}
                      className="flex-1 py-1.5 px-3 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Abrir
                    </button>
                    <button
                      onClick={(e) => duplicateProject(p, e)}
                      title="Duplicar"
                      className="py-1.5 px-2.5 rounded bg-transparent hover:bg-white/5 border border-gray-600 text-gray-300 text-xs transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => deleteProject(p.id, e)}
                      title="Apagar"
                      className="py-1.5 px-2.5 rounded bg-transparent hover:bg-rose-500/10 border border-gray-600 hover:border-rose-500 text-gray-300 hover:text-rose-500 text-xs transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ACTIVE ELEMENT DETAILS SEARCH HANDLER
  const activeElement = activeProject.elements.find(el => el.id === activeElementId);

  // Filter mould templates in left tab lists
  const filteredMoulds = searchTerm 
    ? Object.values(MOULDS_BY_CATEGORY).flat().filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : MOULDS_BY_CATEGORY[currentCategory] || [];

  return (
    <div className="min-h-screen bg-[#1e1f22] text-white flex flex-col antialiased">
      
      {/* GLOBAL NOTIFICATION BAR TOAST */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 border ${
              toastMessage.type === 'success' 
                ? 'bg-[#1cc88a] border-[#20c9a6] text-white' 
                : 'bg-amber-500 border-amber-400 text-white'
            }`}
          >
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. EDITOR HEADER TOOLBAR */}
      <header className="bg-[#2b2d31] border-b border-[#3f4147] px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 hide-on-print">
        {/* Left section logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setActiveProject(null);
              setActiveElementId(null);
            }} 
            className="p-1 px-2 bg-white/5 hover:bg-white/15 rounded text-xs tracking-wide text-gray-300 flex items-center gap-1 transition-all"
          >
            ← Painel
          </button>
          
          <div className="h-4 w-[1px] bg-[#3f4147]" />

          <div className="flex items-center gap-1.5">
            <input 
              type="text" 
              value={activeProject.name}
              onChange={(e) => {
                const updated = projects.map(p => p.id === activeProject.id ? { ...activeProject, name: e.target.value } : p);
                setActiveProject({ ...activeProject, name: e.target.value });
                setProjects(updated);
                saveAllProjectsToLocalStorage(userEmail, updated);
              }}
              className="text-white hover:bg-white/5 focus:bg-[#1e1f22] bg-transparent font-extrabold text-sm font-display rounded px-2 py-1 border border-transparent focus:border-[#007fff] focus:outline-none transition max-w-[170px]"
            />
          </div>
        </div>

        {/* Center section controls */}
        <div className="flex flex-wrap items-center gap-1 md:gap-2">
          {/* Undo / Redo */}
          <div className="flex bg-[#1e1f22] p-1 rounded-lg border border-[#3f4147]">
            <button 
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title="Desfazer"
              className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button 
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title="Refazer"
              className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-[#1e1f22] px-2 py-1 rounded-lg border border-[#3f4147] text-xs font-mono">
            <button onClick={() => setZoom(Math.max(30, zoom - 10))} title="Zoom Out" className="p-1 hover:text-white text-gray-400">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center font-bold text-[11px]">{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))} title="Zoom In" className="p-1 hover:text-white text-gray-400">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ruler & Grid selection templates */}
          <div className="flex bg-[#1e1f22] p-1 rounded-lg border border-[#3f4147]">
            <button 
              onClick={() => setShowRuler(!showRuler)} 
              title={showRuler ? "Ocultar Réguas" : "Mostrar Réguas"}
              className={`p-1.5 rounded transition ${showRuler ? 'bg-[#007fff]/15 text-[#007fff]' : 'text-gray-400 hover:text-white'}`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setShowGrid(!showGrid)} 
              title={showGrid ? "Ocultar Grade" : "Mostrar Grade"}
              className={`p-1.5 rounded transition ${showGrid ? 'bg-[#007fff]/15 text-[#007fff]' : 'text-gray-400 hover:text-white'}`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setSnapToGrid(!snapToGrid)} 
              title={snapToGrid ? "Desativar Encaixar na Grade" : "Ativar Encaixar na Grade (5mm)"}
              className={`p-1.5 rounded transition ${snapToGrid ? 'bg-amber-500/15 text-amber-500' : 'text-gray-400 hover:text-white'}`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintRequest}
            className="bg-transparent hover:bg-white/5 border border-gray-600 hover:border-gray-500 py-1.5 px-3 rounded text-xs font-bold text-gray-200 flex items-center gap-1 cursor-pointer transition"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          <button
            onClick={handleGeneratePDF}
            className="bg-[#007fff] hover:bg-blue-600 py-1.5 px-3 rounded text-xs font-bold text-white flex items-center gap-1 cursor-pointer shadow-lg shadow-blue-500/20 transition"
          >
            <FileDown className="w-3.5 h-3.5" /> Exportar PDF A4
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER PANELS BODY */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">

        {/* 2. LEFT WORKBAR: TEMPLATES, FILE UPLOADERS, TEXT CREATORS */}
        <aside className="w-full md:w-80 bg-[#2b2d31] border-r border-[#3f4147] flex flex-col min-h-0 hide-on-print">
          {/* Main tabs */}
          <div className="grid grid-cols-4 border-b border-[#3f4147] bg-[#1e1f22] p-1">
            <button 
              onClick={() => setActiveTab('moldes')}
              className={`py-2 px-1 text-center font-bold text-[11px]  transition cursor-pointer ${activeTab === 'moldes' ? 'bg-[#2b2d31] text-[#007fff] border-b-2 border-[#007fff]' : 'text-gray-400 hover:text-white'}`}
            >
              Moldes
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 text-center font-bold text-[11px]  transition cursor-pointer ${activeTab === 'upload' ? 'bg-[#2b2d31] text-[#007fff] border-b-2 border-[#007fff]' : 'text-gray-400 hover:text-white'}`}
            >
              Upl. Fotos
            </button>
            <button 
              onClick={() => setActiveTab('texto')}
              className={`py-2 px-1 text-center font-bold text-[11px]  transition cursor-pointer ${activeTab === 'texto' ? 'bg-[#2b2d31] text-[#007fff] border-b-2 border-[#007fff]' : 'text-gray-400 hover:text-white'}`}
            >
              Textos
            </button>
            <button 
              onClick={() => setActiveTab('meus')}
              className={`py-2 px-1 text-center font-bold text-[11px]  transition cursor-pointer ${activeTab === 'meus' ? 'bg-[#2b2d31] text-[#007fff] border-b-2 border-[#007fff]' : 'text-gray-400 hover:text-white'}`}
            >
              Meus M.
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* TAB 1: MOLDES (SHAPES BANK) */}
            {activeTab === 'moldes' && (
              <div className="space-y-4">
                {/* Search mould Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar molde..."
                    className="w-full text-xs bg-[#1e1f22] border border-[#3f4147] rounded-lg pl-9 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#007fff]"
                  />
                </div>

                {/* Categories Horizontal flow */}
                {!searchTerm && (
                  <div className="flex flex-wrap gap-1 border-b border-white/5 pb-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setCurrentCategory(cat.id)}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${currentCategory === cat.id ? 'bg-[#007fff] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Templates Grid listing */}
                {currentCategory === 'letras_estilizadas' ? (
                  <div className="space-y-4">
                    {/* Font selection preview grid */}
                    <div className="bg-[#111214] p-2.5 rounded-lg border border-white/5 space-y-2">
                      <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block">Estilo da Fonte Decorativa:</span>
                      
                      <div className="grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto pr-1">
                        {[
                          { id: 'Rubik Mono One', name: 'Monospaçada Pesada', type: 'Moderna / Quadrada' },
                          { id: 'Passion One', name: 'Sans Ultra Bold', type: 'Moderna / Quadrada' },
                          { id: 'Alfa Slab One', name: 'Slab Serif Forte', type: 'Moderna / Quadrada' },
                          { id: 'Secular One', name: 'Minimalista Firme', type: 'Moderna / Quadrada' },
                          { id: 'Bungee', name: 'Quadrada Bloco', type: 'Moderna / Quadrada' },
                          { id: 'Cinzel Decorative', name: 'Romana Elegante', type: 'Estilizada / Clássica' },
                          { id: 'Chewy', name: 'Arredondada Pop', type: 'Estilizada / Clássica' },
                          { id: 'Spicy Rice', name: 'Artesanal Retro', type: 'Estilizada / Clássica' },
                          { id: 'Lobster', name: 'Cursiva Clássica', type: 'Estilizada / Clássica' },
                          { id: 'Limelight', name: 'Art Deco Vintage', type: 'Estilizada / Clássica' }
                        ].map((f) => {
                          const isSel = selectedStylizedFont === f.id;
                          return (
                            <button
                              key={f.id}
                              onClick={() => setSelectedStylizedFont(f.id)}
                              className={`flex items-center justify-between p-2 rounded text-left transition text-xs border cursor-pointer ${
                                isSel
                                  ? 'bg-[#007fff]/20 border-[#007fff] text-white' 
                                  : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{f.name}</span>
                                <span className="text-[9px] text-gray-500 font-mono">{f.type}</span>
                              </div>
                              <span 
                                className="text-sm font-bold pr-2 text-amber-400" 
                                style={{ fontFamily: f.id }}
                              >
                                ABC
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* A to Z alphabet list using the selected font */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block">Selecione a Letra (A-Z) para Inserir:</span>
                      
                      <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
                        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(l => (
                          <button
                            key={l}
                            onClick={() => addMoldToSheet(`l_est-${l}`, { w: 40, h: 45 }, undefined, selectedStylizedFont)}
                            className="bg-[#1e1f22] border border-[#3f4147] hover:border-[#007fff] rounded-lg p-2.5 text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/5 group"
                          >
                            <span 
                              className="text-2xl text-white group-hover:text-[#007fff] font-bold"
                              style={{ fontFamily: selectedStylizedFont }}
                            >
                              {l}
                            </span>
                            <span className="text-[8px] text-gray-500 font-mono">Letra {l}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {filteredMoulds.map(el => {
                      const isTextIcon = el.iconShape.startsWith('text:');
                      const textVal = isTextIcon ? el.iconShape.split(':')[1] : '';

                      return (
                        <button
                          key={el.id}
                          onClick={() => addMoldToSheet(el.id)}
                          className="bg-[#1e1f22] border border-[#3f4147] text-[#007fff] hover:border-[#007fff] rounded-lg p-3 text-center transition flex flex-col items-center gap-2 group cursor-pointer hover:bg-white/5"
                        >
                          <div className="w-12 h-12 flex items-center justify-center p-1 bg-white/5 rounded relative">
                            {isTextIcon ? (
                              <span className="text-xl font-black text-gray-300 group-hover:text-[#007fff] transition font-display">{textVal}</span>
                            ) : (
                              <svg viewBox="0 0 100 100" className="w-full h-full fill-[#e2e8f0]/30 stroke-[#007fff] stroke-2">
                                {el.iconShape === 'circle' && <circle cx="50" cy="50" r="42" />}
                                {el.iconShape === 'oval' && <ellipse cx="50" cy="50" rx="42" ry="28" />}
                                {el.iconShape === 'oval-largo' && <ellipse cx="50" cy="50" rx="42" ry="34" />}
                                {el.iconShape === 'heart-classic' && <path d="M 50 18 C 35 0, 5 10, 5 45 C 5 72, 40 88, 50 96 C 60 88, 95 72, 95 45 C 95 10, 65 0, 50 18 Z" />}
                                {el.iconShape === 'heart-stretched' && <path d="M 50 12 C 32 -7, 2 2, 2 40 C 2 73, 38 88, 50 98 C 62 88, 98 73, 98 40 C 98 2, 68 -7, 50 12 Z" />}
                                {el.iconShape === 'heart-faceted' && <polygon points="50,15 72,3 95,25 95,50 50,96 5,50 5,25 28,3" />}
                                {el.iconShape === 'rect-rounded' && <rect x="8" y="8" width="84" height="84" rx="10" ry="10" />}
                                {el.iconShape === 'rect-tag' && <rect x="15" y="8" width="70" height="84" rx="10" ry="10" />}
                                {el.iconShape === 'hexagon' && <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" />}
                                {el.iconShape === 'star' && <polygon points="50,6 64,36 96,40 72,62 78,94 50,78 22,94 28,62 4,40 36,36" />}
                                {el.iconShape === 'cloud' && <path d="M 30 70 C 18 70 8 60 8 48 C 8 36 20 28 35 32 C 40 18 60 18 68 30 C 78 22 92 30 92 42 C 96 50 94 68 82 70 Z" />}
                                {el.iconShape === 'bear' && <rect x="10" y="20" width="80" height="60" rx="20" ry="20" />}
                                {el.iconShape === 'shield' && <polygon points="10,10 90,10 90,56 50,94 10,56" />}
                                {el.iconShape === 'shield-classic' && <polygon points="15,5 85,5 85,55 50,95 15,55" />}
                                {el.iconShape === 'paw' && <circle cx="50" cy="50" r="20" />}
                                {el.iconShape === 'bone' && <rect x="10" y="35" width="80" height="30" rx="10" ry="10" />}
                                {el.iconShape === 'clover' && <circle cx="50" cy="50" r="30" />}
                                {el.iconShape === 'christmas-tree' && <polygon points="50,6 90,88 10,88" />}
                                {el.iconShape === 'pen-rect' && <rect x="35" y="10" width="30" height="80" rx="4" ry="4" />}
                                {el.iconShape === 'pen-tapered' && <polygon points="38,10 62,10 54,90 46,90" />}
                                {el.iconShape === 'triangle' && <polygon points="50,10 90,85 10,85" />}
                              </svg>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-300 font-semibold leading-tight">{el.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UPLOAD (USER DECORATIVE PICTURES) */}
            {activeTab === 'upload' && (
              <div className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="border-2 border-dashed border-[#4e5058] hover:border-[#007fff] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition text-center bg-[#1e1f22]">
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="font-bold text-gray-300">Carregar Foto / Fundo</span>
                    <span className="text-[10px] text-gray-500 mt-1">PNG, JPG de alta resolução</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleUploadImageFile} 
                    />
                  </label>
                  
                  <div className="mt-3 flex gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/15 text-amber-200 text-[10px]">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Dica: Selecione um molde na folha central e clique em qualquer foto abaixo para colocá-la dentro do molde!</span>
                  </div>
                </div>

                {/* Picture list */}
                <div className="space-y-2">
                  <h4 className="text-gray-400 text-[10px] uppercase font-mono tracking-wider">Biblioteca de Uploads ({uploadedImages.length})</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {uploadedImages.map((img, index) => (
                      <div 
                        key={index} 
                        draggable="true"
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', img);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDoubleClick={() => {
                          if (activeElementId) {
                            handleDropImageOnMould(img, activeElementId);
                          } else {
                            triggerToast('Dica: Arraste a imagem sobre um molde ou selecione um para aplicar.', 'warn');
                          }
                        }}
                        className={`relative aspect-square rounded-lg bg-[#1e1f22] overflow-hidden border cursor-grab active:cursor-grabbing hover:border-amber-400 transition group ${
                          activeElement && activeElement.imageSrc === img ? 'border-[#007fff] ring-2 ring-[#007fff]/30' : 'border-[#3f4147]'
                        }`}
                      >
                        <img src={img} alt="Upload" className="w-full h-full object-cover pointer-events-none" />
                        
                        {/* Overlay text actions */}
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-1.5 text-center transition">
                          <span className="text-[10px] text-white font-bold mb-1">Arraste para o Molde</span>
                          <span className="text-[8px] text-gray-400">Clique duplo para aplicar</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteUploadedImage(index, e);
                            }}
                            className="mt-2 p-1 rounded bg-rose-500 hover:bg-rose-600 transition text-white"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TEXTS ENGINE */}
            {activeTab === 'texto' && (
              <div className="space-y-4 block text-xs">
                <div className="space-y-2 bg-[#1e1f22] p-3 rounded-lg border border-[#3f4147]">
                  <h4 className="font-semibold text-gray-300">Inserir Texto na Folha</h4>
                  <div className="space-y-1.5">
                    <input 
                      type="text" 
                      value={newText} 
                      onChange={(e) => setNewText(e.target.value)} 
                      placeholder="Ex: Nome, Data..." 
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#007fff]"
                    />
                    <button 
                      onClick={addTextElement}
                      className="w-full py-1.5 px-3 rounded bg-[#007fff] hover:bg-blue-600 font-bold text-white transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar na Folha
                    </button>
                  </div>
                </div>

                <div className="bg-[#1e1f22] p-3 rounded-lg border border-[#3f4147] text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-300">Formatos Especiais em Resina:</p>
                  <p className="text-[10px] leading-relaxed">
                    Você pode selecionar qualquer texto comum na folha e curvá-lo, ou ainda espelhar completamente para colar na parte traseira dos moldes transparentes!
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: MEUS MOLDES & SVG TRACE TOOLS */}
            {activeTab === 'meus' && (
              <div className="space-y-4">
                {/* Image-to-frame creator standalone inside column */}
                <TraceFrameCreator 
                  onFrameCreated={(name, dataUrl) => {
                    const newFrame = { id: `trace-${Date.now()}`, name, maskSrc: dataUrl };
                    const updated = [newFrame, ...customFrames];
                    setCustomFrames(updated);
                    localStorage.setItem('resina_design_custom_frames', JSON.stringify(updated));
                    
                    // Directly add on sheet
                    addMoldToSheet(name, { w: 50, h: 50 }, dataUrl);
                  }}
                />

                {/* Import section SVG */}
                <div className="bg-[#1e1f22] p-4 rounded-lg border border-[#3f4147] space-y-3">
                  <h4 className="text-xs font-semibold text-gray-300">Importar Gabarito Próprio</h4>
                  
                  <label className="border border-dashed border-[#4e5058] hover:border-[#007fff] rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition text-center bg-[#2b2d31]">
                    <span className="text-[11px] font-bold text-gray-300">Carregar Molde (.SVG)</span>
                    <input 
                      type="file" 
                      accept=".svg" 
                      className="hidden" 
                      onChange={handleImportMouldSVG} 
                    />
                  </label>
                </div>

                {/* Trace frame listing library */}
                {customFrames.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">Meus Moldes Salvos ({customFrames.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {customFrames.map((frame) => (
                        <div 
                          key={frame.id}
                          onClick={() => {
                            addMoldToSheet(frame.name, { w: 50, h: 50 }, frame.maskSrc);
                          }}
                          className="bg-[#1e1f22] border border-[#3f4147] hover:border-[#007fff] p-2.5 rounded text-center cursor-pointer transition flex flex-col items-center gap-1 group"
                        >
                          <div className="w-12 h-12 bg-white/5 rounded p-1 flex items-center justify-center pattern-bg">
                            <img src={frame.maskSrc} alt="Mask" className="w-full h-full object-contain filter invert opacity-80" />
                          </div>
                          <span className="text-[9px] text-gray-400 font-bold truncate w-full">{frame.name}</span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = customFrames.filter(f => f.id !== frame.id);
                              setCustomFrames(updated);
                              localStorage.setItem('resina_design_custom_frames', JSON.stringify(updated));
                              triggerToast('Molde personalizado excluído.');
                            }}
                            className="mt-1 opacity-0 group-hover:opacity-100 transition absolute p-1 bg-rose-500 text-white rounded text-[8px]"
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>

          {/* Footer warning */}
          <div className="p-3 border-t border-[#3f4147] bg-[#1e1f22] text-[10.5px] text-gray-400 leading-normal">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Dica de Impressão: Para manter os tamanhos em milímetros corretos na régua, selecione <strong>Escala 100%</strong> ou <strong>Tamanho Real</strong> na janela de impressão.</span>
            </div>
          </div>
        </aside>

        {/* 3. CENTER EDITOR WORKSPACE: A4 WRITER CANVAS SHEET */}
        <main className="flex-1 overflow-auto bg-[#1e1f22] relative p-8 flex flex-col items-center justify-start pattern-bg">
          
          {/* SHEET TABS (PAGES) */}
          {activeProject && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6 bg-[#111214]/60 p-1.5 px-3 rounded-xl border border-white/5 hide-on-print shadow-xl max-w-full">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 mr-2 select-none flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" /> Folhas do Projeto:
              </span>
              
              <div className="flex flex-wrap items-center gap-1">
                {(activeProject.sheets || [
                  { id: 'sheet-main', name: 'Folha 1', elements: activeProject.elements }
                ]).map((sheet) => {
                  const isActive = (activeProject.activeSheetId || 'sheet-main') === sheet.id;
                  return (
                    <div 
                      key={sheet.id}
                      onClick={() => handleSwitchSheet(sheet.id)}
                      className={`group/tab relative flex items-center gap-2 py-1 px-3 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                        isActive 
                          ? 'bg-[#007fff] text-white shadow-lg shadow-blue-500/10' 
                          : 'bg-[#2b2d31]/80 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {/* Static sheet tab text display */}
                      <span className="font-bold select-none pr-1">
                        {sheet.name}
                      </span>
                      
                      {/* Delete button (displays except if only 1 tab exists) */}
                      <button 
                        onClick={(e) => handleDeleteSheet(sheet.id, e)}
                        className={`p-0.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition ${
                          (activeProject.sheets?.length || 1) <= 1 ? 'hidden' : 'block'
                        }`}
                        title="Excluir Folha"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="h-4 w-[1px] bg-white/10 mx-1" />

              <button 
                onClick={handleAddNewSheet}
                className="py-1 px-2.5 bg-green-600/25 hover:bg-green-600 text-green-400 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                title="Criar nova folha de desenho em branco"
              >
                <Plus className="w-3.5 h-3.5" /> + Folha
              </button>
            </div>
          )}

          {/* Virtual scroll wrap */}
          <div 
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.1s ease-out'
            }}
            className="relative print-container shrink-0"
          >
            {/* Horizontal physical layout ruler labels */}
            {showRuler && (
              <div 
                className="absolute left-0 bottom-full h-5 bg-[#2b2d31]/80 border-t border-r border-[#3f4147] flex text-[8px] text-gray-500 font-mono pointer-events-none transition select-none overflow-hidden hide-on-print"
                style={{
                  width: `${A4_WIDTH_MM}mm`,
                }}
              >
                {/* 10mm ticks ruler intervals */}
                {Array.from({ length: Math.floor(A4_WIDTH_MM / 10) + 1 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute border-l border-gray-600 h-full"
                    style={{ left: `${i * 10}mm` }}
                  >
                    <span className="pl-0.5 pt-0.5 block">{i}cm</span>
                  </div>
                ))}
              </div>
            )}

            {/* Vertical physical layout ruler labels */}
            {showRuler && (
              <div 
                className="absolute top-0 right-full w-5 bg-[#2b2d31]/80 border-l border-b border-[#3f4147] text-[8px] text-gray-500 font-mono pointer-events-none transition select-none overflow-hidden hide-on-print"
                style={{
                  height: `${A4_HEIGHT_MM}mm`,
                }}
              >
                {/* 10mm ticks vertical intervals */}
                {Array.from({ length: Math.floor(A4_HEIGHT_MM / 10) + 1 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute border-t border-gray-600 w-full"
                    style={{ top: `${i * 10}mm` }}
                  >
                    <span className="pl-1 pt-0.5 block">{i}cm</span>
                  </div>
                ))}
              </div>
            )}

            {/* THE A4 WHITE CARD CANVAS SHEET */}
            <div 
              id="a4-printable-stage"
              ref={a4SheetRef}
              onClick={handleSheetMouseDown}
              className={`bg-white shadow-2xl relative select-none cursor-crosshair box-border transition-shadow rounded overflow-hidden ${
                showGrid && !isGeneratingPDF ? 'canvas-grid' : ''
              } ${showGrid && !isGeneratingPDF ? 'canvas-grid-sub' : ''}`}
              style={{
                width: `${A4_WIDTH_MM}mm`,
                height: `${A4_HEIGHT_MM}mm`,
              }}
            >
              {/* Element rendering maps overlay */}
              {activeProject.elements
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((element) => {
                  const isSelected = element.id === activeElementId;
                  const isOutBounds = (element.x + element.width > A4_WIDTH_MM) || (element.y + element.height > A4_HEIGHT_MM) || (element.x < 0) || (element.y < 0);

                  return (
                    <div
                      key={element.id}
                      style={{
                        position: 'absolute',
                        left: `${element.x}mm`,
                        top: `${element.y}mm`,
                        width: `${element.width}mm`,
                        height: `${element.height}mm`,
                        transform: `rotate(${element.rotation}deg)`,
                        transformOrigin: 'center center',
                        zIndex: element.zIndex,
                        cursor: element.isLocked ? 'not-allowed' : 'move',
                      }}
                      onMouseDown={(e) => handleElementMouseDown(e, element, 'translate')}
                      onTouchStart={(e) => handleElementTouchStart(e, element, 'translate')}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.outline = '2.5px solid #1cc88a';
                        e.currentTarget.style.boxShadow = '0 0 12px #1cc88a';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.outline = '';
                        e.currentTarget.style.boxShadow = '';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.outline = '';
                        e.currentTarget.style.boxShadow = '';
                        const imgUrl = e.dataTransfer.getData('text/plain');
                        if (imgUrl) {
                          handleDropImageOnMould(imgUrl, element.id);
                        }
                      }}
                      className={`group ${
                        isSelected ? 'ring-2 ring-blue-500/80 ring-offset-2' : ''
                      } ${
                        isOutBounds && isSelected ? 'ring-2 ring-red-500 ring-offset-2' : ''
                      }`}
                    >
                      {/* Coped content wrapper clipping frame */}
                      <div className="w-full h-full relative">
                        {/* 1. Normal shape vs customized SVG frame */}
                        {element.type === 'text' ? (
                          element.isCurved ? (
                            // Curved vector text rendering path anchor
                            <div className="w-full h-full" style={{ transform: `scale(${element.isMirroredH ? -1 : 1}, ${element.isMirroredV ? -1 : 1})` }}>
                              <svg width="100%" height="100%" viewBox={`0 0 ${element.width} ${element.height}`} preserveAspectRatio="none">
                                <defs>
                                  <path id={`curve-${element.id}`} d={getCurvePath(element)} fill="none" />
                                </defs>
                                <text 
                                  fill={element.textColor}
                                  fontSize={element.fontSize}
                                  fontWeight={element.textBold ? '900' : 'normal'}
                                  fontStyle={element.textItalic ? 'italic' : 'normal'}
                                  fontFamily={element.fontFamily}
                                  letterSpacing={element.letterSpacing}
                                >
                                  <textPath href={`#curve-${element.id}`} startOffset="50%" textAnchor="middle">
                                    {element.text}
                                  </textPath>
                                </text>
                              </svg>
                            </div>
                          ) : (
                            // Pure simple standard text formatting block
                            <div 
                              style={{
                                width: '100%',
                                height: '100%',
                                transform: `scale(${element.isMirroredH ? -1 : 1}, ${element.isMirroredV ? -1 : 1})`,
                                color: element.textColor,
                                fontFamily: element.fontFamily,
                                fontSize: `${element.fontSize}mm`,
                                fontWeight: element.textBold ? '900' : 'normal',
                                fontStyle: element.textItalic ? 'italic' : 'normal',
                                letterSpacing: `${element.letterSpacing || 0}mm`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: element.textAlignment === 'left' ? 'flex-start' : element.textAlignment === 'right' ? 'flex-end' : 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {element.text}
                            </div>
                          )
                        ) : element.customMaskSrc ? (
                          // Custom PNG Frame (Image to Frame) representation
                          <div 
                            className="w-full h-full relative"
                            style={{
                              maskImage: `url(${element.customMaskSrc})`,
                              WebkitMaskImage: `url(${element.customMaskSrc})`,
                              maskSize: '100% 100%',
                              WebkitMaskSize: '100% 100%',
                              maskRepeat: 'no-repeat',
                              WebkitMaskRepeat: 'no-repeat',
                              transform: `scale(${element.isMirroredH ? -1 : 1}, ${element.isMirroredV ? -1 : 1})`
                            }}
                          >
                            {/* Empty back fill */}
                            {!element.imageSrc && (
                              <div className="w-full h-full" style={{ backgroundColor: element.fillColor }} />
                            )}
                            
                            {/* Custom uploaded image fitted within bounds */}
                            {element.imageSrc && (
                              <img 
                                src={element.imageSrc} 
                                alt="Fitted"
                                style={{
                                  position: 'absolute',
                                  left: `calc(50% + ${element.imageX}mm)`,
                                  top: `calc(50% + ${element.imageY}mm)`,
                                  width: `${100 * element.imageScale}%`,
                                  height: `${100 * element.imageScale}%`,
                                  transform: `translate(-50%, -50%) rotate(${element.imageRotation}deg) scale(${element.imageFlipH ? -1 : 1}, ${element.imageFlipV ? -1 : 1})`,
                                  transformOrigin: 'center center',
                                  pointerEvents: 'none',
                                  maxWidth: 'none',
                                  display: 'block'
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          // Standard vector template mold
                          renderShapeBody(element)
                        )}

                        {/* Drag and adjust overlays if image is loaded into frame */}
                        {isSelected && element.imageSrc && !element.isLocked && (
                          <div 
                            title="Arraste para posicionar a foto dentro do molde"
                            onMouseDown={(e) => handleElementMouseDown(e, element, 'image-pan')}
                            onTouchStart={(e) => handleElementTouchStart(e, element, 'image-pan')}
                            className="absolute inset-4 border border-dashed border-blue-500/60 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-[#007fff]/10 transition cursor-all-scroll rounded"
                          >
                            <Move className="w-5 h-5 text-[#007fff]" />
                          </div>
                        )}
                        
                        {/* Render visual lock indicator */}
                        {element.isLocked && (
                          <div className="absolute top-1 right-1 bg-[#1e1f22]/85 p-1 rounded-full border border-[#3f4147] text-gray-400">
                            <Lock className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      {/* 2. Interactive Resizing Handles (only shown on selected) */}
                      {isSelected && !element.isLocked && (
                        <>
                          {/* Corner Scale (Bottom Right) diagonal proportional */}
                          <div
                            onMouseDown={(e) => handleElementMouseDown(e, element, 'resize-se')}
                            onTouchStart={(e) => handleElementTouchStart(e, element, 'resize-se')}
                            className="absolute h-3 w-3 rounded-full border border-white bg-blue-500 -bottom-1 -right-1 z-30 cursor-se-resize shadow shadow-black"
                          />
                          {/* Horizontal Stretch Handle (Right) */}
                          <div
                            onMouseDown={(e) => handleElementMouseDown(e, element, 'resize-e')}
                            onTouchStart={(e) => handleElementTouchStart(e, element, 'resize-e')}
                            className="absolute h-3 w-1.5 bg-blue-500 border border-white top-1/2 -right-1 -translate-y-1/2 z-30 cursor-e-resize rounded shadow shadow-black"
                          />
                          {/* Vertical Stretch Handle (Bottom) */}
                          <div
                            onMouseDown={(e) => handleElementMouseDown(e, element, 'resize-s')}
                            onTouchStart={(e) => handleElementTouchStart(e, element, 'resize-s')}
                            className="absolute h-1.5 w-3 bg-blue-500 border border-white -bottom-1 left-1/2 -translate-x-1/2 z-30 cursor-s-resize rounded shadow shadow-black"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

              {/* OUT OF PRINTING AREA ADVISORY WARNING OVERLAY */}
              {activeProject.elements.some(element => (element.x + element.width > A4_WIDTH_MM) || (element.y + element.height > A4_HEIGHT_MM) || (element.x < 0) || (element.y < 0)) && (
                <div className="absolute bottom-2 flex justify-center w-full hide-on-print pointer-events-none z-50">
                  <div className="bg-amber-500 border border-amber-400 text-white font-bold text-[10px] px-3 py-1 rounded-full flex items-center gap-1 shadow-lg pointer-events-auto leading-none">
                    <Info className="w-3.5 h-3.5" />
                    <span>⚠️ Há itens fora do tamanho da folha A4 (Não serão impressos!)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 4. RIGHT WORKBAR: DETAILED POSITIONING & PROPERTIES ADJUSTMENTS */}
        <aside className="w-full md:w-80 bg-[#2b2d31] border-l border-[#3f4147] flex flex-col p-4 space-y-4 overflow-y-auto hide-on-print">
          
          {/* Active selection title banner */}
          <div className="bg-[#1e1f22] p-3 rounded-lg border border-[#3f4147] text-center">
            <h3 className="text-xs font-mono text-gray-400">Elemento Selecionado</h3>
            <p className="text-sm font-bold text-gray-100 truncate mt-1">
              {activeElement ? activeElement.name : 'Nenhum Item Selecionado'}
            </p>
          </div>

          {activeElement ? (
            <div className="space-y-4 text-xs font-semibold">
              
              {/* POSITIONING PANEL */}
              <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147]">
                <h4 className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1 text-[#007fff]">
                  <Move className="w-3.5 h-3.5" /> Posição e Medidas (cm / mm)
                </h4>
                
                {/* Millimeter Inputs */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-gray-400 block mb-0.5">X (mm)</label>
                    <input 
                      type="number" 
                      step="1"
                      value={Math.round(activeElement.x)} 
                      onChange={(e) => handleUpdateElementProps({ x: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1 text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Y (mm)</label>
                    <input 
                      type="number" 
                      step="1"
                      value={Math.round(activeElement.y)} 
                      onChange={(e) => handleUpdateElementProps({ y: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1 text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Largura (mm)</label>
                    <input 
                      type="number" 
                      step="1"
                      min="5"
                      value={Math.round(activeElement.width)} 
                      onChange={(e) => handleUpdateElementProps({ width: parseFloat(e.target.value) || 10 })}
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1 text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Altura (mm)</label>
                    <input 
                      type="number" 
                      step="1"
                      min="5"
                      value={Math.round(activeElement.height)} 
                      onChange={(e) => handleUpdateElementProps({ height: parseFloat(e.target.value) || 10 })}
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1 text-white text-center"
                    />
                  </div>
                </div>

                {/* CM visual helpers */}
                <div className="text-[10px] text-gray-500 font-mono text-center pt-1 flex justify-around">
                  <span>L: {(activeElement.width / 10).toFixed(1)} cm</span>
                  <span>A: {(activeElement.height / 10).toFixed(1)} cm</span>
                </div>
              </div>

              {/* MIRROR & ROTATION CONTROLS */}
              <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147]">
                <h4 className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1 text-[#007fff]">
                  <RotateCw className="w-3.5 h-3.5" /> Rotação e Espelhar
                </h4>
                
                {/* Angle Slider */}
                <div>
                  <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                    <span>Ângulo do Molde:</span>
                    <span className="font-mono text-[#007fff]">{activeElement.rotation}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    value={activeElement.rotation} 
                    onChange={(e) => handleUpdateElementProps({ rotation: parseInt(e.target.value) })}
                    className="w-full accent-[#007fff] cursor-pointer"
                  />
                </div>

                {/* Mirroring Toggles */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    onClick={() => handleUpdateElementProps({ isMirroredH: !activeElement.isMirroredH })}
                    className={`py-1.5 rounded transition font-medium text-[11px] flex items-center justify-center gap-1 border border-[#3f4147] ${activeElement.isMirroredH ? 'bg-[#007fff]/10 border-[#007fff] text-[#007fff]' : 'bg-transparent text-gray-400 hover:text-white'}`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" /> Espelhar H
                  </button>
                  <button 
                    onClick={() => handleUpdateElementProps({ isMirroredV: !activeElement.isMirroredV })}
                    className={`py-1.5 rounded transition font-medium text-[11px] flex items-center justify-center gap-1 border border-[#3f4147] ${activeElement.isMirroredV ? 'bg-[#007fff]/10 border-[#007fff] text-[#007fff]' : 'bg-transparent text-gray-400 hover:text-white'}`}
                  >
                    <FlipVertical className="w-3.5 h-3.5" /> Espelhar V
                  </button>
                </div>
              </div>

              {/* TEXT ADVANCED PARAMETERS */}
              {activeElement.type === 'text' && (
                <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147]">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1 text-[#007fff]">
                    <Type className="w-3.5 h-3.5" /> Ajustes do Texto
                  </h4>
                  
                  {/* Dynamic value rename */}
                  <div>
                    <label className="text-gray-400 block mb-1">Editar Texto:</label>
                    <input 
                      type="text" 
                      value={activeElement.text}
                      onChange={(e) => handleUpdateElementProps({ text: e.target.value })}
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1.5 text-white"
                    />
                  </div>

                  {/* Fonts selector */}
                  <div>
                    <label className="text-gray-400 block mb-1">Letra / Fonte:</label>
                    <select 
                      value={activeElement.fontFamily}
                      onChange={(e) => handleUpdateElementProps({ fontFamily: e.target.value })}
                      className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1.5 text-white"
                    >
                      {GOOGLE_FONTS.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                      ))}
                    </select>
                  </div>

                  {/* Size and letter spacing */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-400 block mb-1">Tamanho (mm)</label>
                      <input 
                        type="number" 
                        value={activeElement.fontSize}
                        onChange={(e) => handleUpdateElementProps({ fontSize: parseFloat(e.target.value) || 8 })}
                        className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1 text-white text-center"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-1">Espaço (mm)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={activeElement.letterSpacing || 0}
                        onChange={(e) => handleUpdateElementProps({ letterSpacing: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#2b2d31] border border-[#3f4147] rounded p-1 text-white text-center"
                      />
                    </div>
                  </div>

                  {/* Dynamic curves controller */}
                  <div className="border-t border-[#3f4147] pt-2 mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-gray-300">Texto Curvado / Arco:</label>
                      <input 
                        type="checkbox" 
                        checked={activeElement.isCurved || false}
                        onChange={(e) => handleUpdateElementProps({ isCurved: e.target.checked })}
                        className="w-4 h-4 cursor-pointer accent-[#007fff]"
                      />
                    </div>

                    {activeElement.isCurved && (
                      <div className="space-y-1.5 p-2 bg-[#1e1f22]/80 rounded border border-[#3f4147]">
                        <div className="flex justify-between">
                          <span>Intensidade da curva:</span>
                          <span className="font-mono text-[#007fff]">{activeElement.curveRadius}</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="150" 
                          value={activeElement.curveRadius}
                          onChange={(e) => handleUpdateElementProps({ curveRadius: parseInt(e.target.value) })}
                          className="w-full accent-[#007fff]"
                        />

                        <div className="flex items-center gap-3 mt-1.5">
                          <span>Direção:</span>
                          <label className="flex items-center gap-1 text-gray-300">
                            <input 
                              type="radio" 
                              name="curve-direction"
                              checked={activeElement.curveDirection === 'up'}
                              onChange={() => handleUpdateElementProps({ curveDirection: 'up' })}
                              className="accent-[#007fff]"
                            />
                            Arqueado
                          </label>
                          <label className="flex items-center gap-1 text-gray-300">
                            <input 
                              type="radio" 
                              name="curve-direction"
                              checked={activeElement.curveDirection === 'down'}
                              onChange={() => handleUpdateElementProps({ curveDirection: 'down' })}
                              className="accent-[#007fff]"
                            />
                            Abatido
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text properties colors */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-300">Cor do Texto:</span>
                    <input 
                      type="color" 
                      value={activeElement.textColor}
                      onChange={(e) => handleUpdateElementProps({ textColor: e.target.value })}
                      className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>
                </div>
              )}

              {/* IMAGE ADJUSTMENT INSIDE THE CLIP MASK */}
              {activeElement.imageSrc && (
                <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147]">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-amber-400 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Ajustes da Imagem Interna
                  </h4>

                  {/* Zoom inside masks slider */}
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                      <span>Zoom da Foto:</span>
                      <span className="font-mono text-amber-400">{(activeElement.imageScale * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.3" 
                      max="3.5" 
                      step="0.01"
                      value={activeElement.imageScale} 
                      onChange={(e) => handleUpdateElementProps({ imageScale: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Manual Panning sliders */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-400 block mb-0.5">X Relativo (mm)</span>
                      <input 
                        type="range" 
                        min="-120" 
                        max="120" 
                        step="0.5"
                        value={activeElement.imageX}
                        onChange={(e) => handleUpdateElementProps({ imageX: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">Y Relativo (mm)</span>
                      <input 
                        type="range" 
                        min="-120" 
                        max="120" 
                        step="0.5"
                        value={activeElement.imageY}
                        onChange={(e) => handleUpdateElementProps({ imageY: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>

                  {/* image rotation inside frames */}
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                      <span>Girar Foto Interna:</span>
                      <span className="font-mono text-amber-400">{activeElement.imageRotation || 0}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="360" 
                      value={activeElement.imageRotation || 0} 
                      onChange={(e) => handleUpdateElementProps({ imageRotation: parseInt(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Mirror background image flips */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                    <button 
                      onClick={() => handleUpdateElementProps({ imageFlipH: !activeElement.imageFlipH })}
                      className={`py-1 rounded text-[10px] border border-[#3f4147] transition ${activeElement.imageFlipH ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Espelhar H Foto
                    </button>
                    <button 
                      onClick={() => handleUpdateElementProps({ imageFlipV: !activeElement.imageFlipV })}
                      className={`py-1 rounded text-[10px] border border-[#3f4147] transition ${activeElement.imageFlipV ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                      Espelhar V Foto
                    </button>
                  </div>

                  {/* Reset centers button */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button 
                      onClick={() => handleUpdateElementProps({ imageScale: 1.0, imageX: 0, imageY: 0, imageRotation: 0, imageFlipH: false, imageFlipV: false })}
                      className="py-1 rounded text-[10px] bg-[#1e1f22] border border-[#3f4147] hover:bg-gray-700 text-gray-300"
                    >
                      Preencher / Reset
                    </button>
                    <button 
                      onClick={() => handleUpdateElementProps({ imageSrc: undefined })}
                      className="py-1 rounded text-[10px] bg-rose-950 border border-rose-900 text-rose-300 hover:bg-rose-900"
                    >
                      Remover Foto
                    </button>
                  </div>
                </div>
              )}

              {/* COLORS FILL & STROKE PREPARATION */}
              {activeElement.type !== 'text' && (
                <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147]">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1 text-[#007fff]">
                    <Award className="w-3.5 h-3.5" /> Cores e Outlines (Corte)
                  </h4>

                  <div className="flex items-center justify-between text-[11px] text-gray-300">
                    <span>Fundo Sólido (sem foto):</span>
                    <input 
                      type="color" 
                      value={activeElement.fillColor} 
                      onChange={(e) => handleUpdateElementProps({ fillColor: e.target.value })}
                      className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-300">
                    <span>Contorno (Corte):</span>
                    <input 
                      type="color" 
                      value={activeElement.strokeColor} 
                      onChange={(e) => handleUpdateElementProps({ strokeColor: e.target.value })}
                      className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                    />
                  </div>

                  {/* Contorno thickness slider */}
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-300 mb-0.5">
                      <span>Espessura (mm):</span>
                      <span className="font-mono text-[#007fff]">{activeElement.strokeWidth} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="3" 
                      step="0.1"
                      value={activeElement.strokeWidth} 
                      onChange={(e) => handleUpdateElementProps({ strokeWidth: parseFloat(e.target.value) })}
                      className="w-full accent-[#007fff]"
                    />
                  </div>

                  {/* Hole for chain option toggle */}
                  {!activeElement.customMaskSrc && (
                    <div className="flex items-center justify-between pt-1 border-t border-[#3f4147]/40 mt-1">
                      <span className="text-gray-300 text-[11px]">Furo de Argola (Plaqueta):</span>
                      <input 
                        type="checkbox" 
                        checked={activeElement.ringHole} 
                        onChange={(e) => handleUpdateElementProps({ ringHole: e.target.checked })}
                        className="w-4 h-4 cursor-pointer accent-[#007fff]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* LAYERS & POSITION CONTROLS */}
              <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147]">
                <h4 className="text-[10px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1 text-[#007fff]">
                  <Layers className="w-3.5 h-3.5" /> Camadas e Organização
                </h4>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    onClick={() => {
                      const maxZ = activeProject.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
                      handleUpdateElementProps({ zIndex: maxZ + 1 });
                      triggerToast('Item trazido para frente.');
                    }}
                    className="py-1.5 rounded bg-transparent hover:bg-white/5 border border-gray-600 text-gray-300 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ChevronUp className="w-3 h-3 text-green-400" /> Trazer Frente
                  </button>
                  <button
                    onClick={() => {
                      const minZ = activeProject.elements.reduce((acc, el) => Math.min(acc, el.zIndex), 0);
                      handleUpdateElementProps({ zIndex: minZ - 1 });
                      triggerToast('Item enviado para trás.');
                    }}
                    className="py-1.5 rounded bg-transparent hover:bg-white/5 border border-gray-600 text-gray-300 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ChevronDown className="w-3 h-3 text-amber-500" /> Enviar Trás
                  </button>
                </div>

                {/* Lock Toggle */}
                <button
                  onClick={() => handleUpdateElementProps({ isLocked: !activeElement.isLocked })}
                  className={`w-full py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border transition-all duration-300 ${activeElement.isLocked ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' : 'bg-transparent border-gray-600 hover:bg-white/5 text-gray-300'}`}
                >
                  {activeElement.isLocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" /> Destravar Molde
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" /> Travar Molde (Fixar)
                    </>
                  )}
                </button>
              </div>

              {/* ALIGNMENT SHORTCUTS */}
              <div className="space-y-2 bg-[#1e1f22]/50 p-3 rounded-lg border border-[#3f4147] text-[11px]">
                <h4 className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Alinhamento Relativo</h4>
                <div className="grid grid-cols-3 gap-1">
                  <button 
                    onClick={() => handleUpdateElementProps({ x: 0 })}
                    className="py-1 rounded bg-[#1e1f22] text-gray-300 hover:bg-gray-700 text-[10px]"
                  >
                    Esquerda A4
                  </button>
                  <button 
                    onClick={() => handleUpdateElementProps({ x: (A4_WIDTH_MM - activeElement.width) / 2 })}
                    className="py-1 rounded bg-[#1e1f22] text-gray-300 hover:bg-gray-700 text-[10px]"
                  >
                    Centro A4
                  </button>
                  <button 
                    onClick={() => handleUpdateElementProps({ x: A4_WIDTH_MM - activeElement.width })}
                    className="py-1 rounded bg-[#1e1f22] text-gray-300 hover:bg-gray-700 text-[10px]"
                  >
                    Direita A4
                  </button>
                  <button 
                    onClick={() => handleUpdateElementProps({ y: 0 })}
                    className="py-1 rounded bg-[#1e1f22] text-gray-300 hover:bg-gray-700 text-[10px]"
                  >
                    Topo A4
                  </button>
                  <button 
                    onClick={() => handleUpdateElementProps({ y: (A4_HEIGHT_MM - activeElement.height) / 2 })}
                    className="py-1 rounded bg-[#1e1f22] text-gray-300 hover:bg-gray-700 text-[10px]"
                  >
                    Meio A4
                  </button>
                  <button 
                    onClick={() => handleUpdateElementProps({ y: A4_HEIGHT_MM - activeElement.height })}
                    className="py-1 rounded bg-[#1e1f22] text-gray-300 hover:bg-gray-700 text-[10px]"
                  >
                    Base A4
                  </button>
                </div>
              </div>

              {/* CORE ACTIONS ROW (DUPLICATE & TRASH) */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3f4147]">
                <button
                  onClick={duplicateSelectedElement}
                  className="py-2 rounded bg-[#1e1f22] hover:bg-gray-700 border border-[#3f4147] hover:border-gray-500 font-bold text-gray-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicar
                </button>
                <button
                  onClick={deleteSelectedElement}
                  className="py-2 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500 text-rose-400 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Apagar
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-3">
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-400">Selecione um Molde</p>
                <p className="text-[10px] leading-relaxed max-w-[180px] mx-auto text-gray-500">
                  Clique em qualquer item na folha central para editar dimensões, contornos, espelhar ou ajustar fotos.
                </p>
              </div>
            </div>
          )}

        </aside>

      </div>
    </div>
  );
}
