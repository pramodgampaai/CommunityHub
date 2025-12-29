
import React, { useState, useEffect } from 'react';
import { getCommunity, bulkCreateCommunityUsers } from '../services/api';
import type { Community } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import FeedbackModal from '../components/ui/FeedbackModal';
import { useAuth } from '../hooks/useAuth';
import { 
    ArrowDownTrayIcon, 
    AlertTriangleIcon, 
    CheckCircleIcon, 
    HistoryIcon, 
    CloudArrowUpIcon, 
    TrashIcon, 
    ArrowRightIcon, 
    Squares2X2Icon,
    ChevronDownIcon,
    UserGroupIcon,
    CurrencyRupeeIcon,
    BellIcon
} from '../components/icons';
import { motion, AnimatePresence } from 'framer-motion';

// Using bare imports to leverage importmap
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

const BulkOperations: React.FC = () => {
    const { user } = useAuth();
    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSection, setExpandedSection] = useState<string | null>('residents');
    
    // Resident Onboarding Local States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'info', title: '', message: ''
    });

    useEffect(() => {
        const init = async () => {
            if (!user?.communityId) return;
            try {
                setLoading(true);
                const data = await getCommunity(user.communityId);
                setCommunity(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [user]);

    const isStandalone = community?.communityType?.includes('Standalone');
    const isVilla = community?.communityType === 'Gated Community Villa';

    const getTemplateHeaders = () => {
        const common = ['Full Name', 'Email ID', 'Password', 'Bill Start Date (YYYY-MM-DD)', 'Area SqFt'];
        if (isVilla) return [...common, 'Road Name', 'Villa Number'];
        if (isStandalone) return [...common, 'Floor Number', 'Flat Number'];
        return [...common, 'Block/Tower Name', 'Floor Number', 'Flat Number'];
    };

    const downloadTemplate = async () => {
        if (!community) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resident Data');
        
        const headers = getTemplateHeaders();
        worksheet.addRow(headers);

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0D9488' } 
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        const validBlocks = community.blocks?.map(b => b.name) || [];
        const maxFloors = community.blocks?.reduce((max, b) => Math.max(max, b.floorCount), 0) || 40;
        const floorRange = Array.from({ length: maxFloors }, (_, i) => String(i + 1));

        for (let i = 2; i <= 52; i++) {
            const row = worksheet.getRow(i);
            
            if (isVilla) {
                row.getCell(6).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${validBlocks.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Road',
                    error: 'Please select a valid road from the provided list.'
                };
            } else if (isStandalone) {
                row.getCell(6).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${floorRange.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Floor',
                    error: 'Please select a floor number within your building range.'
                };
            } else {
                row.getCell(6).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${validBlocks.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Block',
                    error: 'Please select a valid block/tower from the provided list.'
                };
                row.getCell(7).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${floorRange.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Floor',
                    error: 'Please select a floor number within your community range.'
                };
            }
        }

        worksheet.columns.forEach(column => {
            column.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Nilayam_Bulk_Onboarding_${community.name.replace(/\s+/g, '_')}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    const parseExcelDate = (val: any): string => {
        const fallback = new Date().toISOString().split('T')[0];
        if (val === undefined || val === null || val === '') return fallback;
        const str = String(val).trim();
        const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
        const parts = str.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        if (val instanceof Date) {
            const year = val.getFullYear();
            const month = String(val.getMonth() + 1).padStart(2, '0');
            const day = String(val.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return fallback;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { raw: false });
                
                if (data.length === 0) {
                    setUploadError("The uploaded file contains no data rows.");
                    return;
                }

                const firstRow: any = data[0];
                const hasName = firstRow['Full Name'] || firstRow['Name'];
                if (!hasName) {
                    setUploadError("Header mismatch: Please ensure you use the official 'Full Name' column from the template.");
                    return;
                }

                const normalizedData = data.map((row: any) => {
                    const dateKey = Object.keys(row).find(k => k.toLowerCase().includes('bill start date'));
                    if (dateKey) row[dateKey] = parseExcelDate(row[dateKey]);
                    return row;
                });

                setPreviewData(normalizedData);
            } catch (err) {
                console.error(err);
                setUploadError("File parse error. Ensure the document is a valid .xlsx or .csv file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const processBulkCreate = async () => {
        if (!user?.communityId || previewData.length === 0) return;
        setIsSubmitting(true);
        try {
            const usersPayload = previewData.map(row => {
                const dateKey = Object.keys(row).find(k => k.toLowerCase().includes('bill start date')) || 'Bill Start Date (YYYY-MM-DD)';
                const unit_data: any = {
                    flat_number: String(row['Flat Number'] || row['Villa Number'] || ''),
                    flat_size: parseFloat(row['Area SqFt']) || 0,
                    maintenance_start_date: row[dateKey],
                    block: row['Block/Tower Name'] || row['Road Name'] || (isStandalone ? 'Main Building' : ''),
                    floor: parseInt(row['Floor Number']) || undefined
                };
                return {
                    name: row['Full Name'] || row['Name'],
                    email: row['Email ID'] || row['Email'],
                    password: row['Password'] || 'Welcome@123',
                    unit_data
                };
            });

            await bulkCreateCommunityUsers(usersPayload, user.communityId);
            setFeedback({ isOpen: true, type: 'success', title: 'Provisioning Complete', message: `Successfully initialized accounts and ledgers for ${usersPayload.length} residents.` });
            setPreviewData([]);
            setFileName(null);
        } catch (err: any) {
            console.error(err);
            setFeedback({ isOpen: true, type: 'error', title: 'Onboarding Halted', message: err.message || "An error occurred during bulk ingestion." });
        } finally { setIsSubmitting(false); }
    };

    const resetWizard = () => {
        setPreviewData([]);
        setFileName(null);
        setUploadError(null);
    };

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Spinner />
        </div>
    );

    const steps = [
        { id: 1, label: 'Template', done: !!community },
        { id: 2, label: 'Upload', done: previewData.length > 0 },
        { id: 3, label: 'Verify', done: isSubmitting }
    ];

    const AccordionHeader: React.FC<{ 
        id: string; 
        title: string; 
        icon: React.FC<any>; 
        description: string;
        isExpanded: boolean;
    }> = ({ id, title, icon: Icon, description, isExpanded }) => (
        <button 
            onClick={() => toggleSection(id)}
            className={`w-full flex items-center justify-between p-6 text-left transition-all ${
                isExpanded 
                ? 'bg-slate-50/50 dark:bg-white/[0.02]' 
                : 'hover:bg-slate-50 dark:hover:bg-white/[0.01]'
            }`}
        >
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl transition-all ${
                    isExpanded ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20 scale-110' : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                }`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight">{title}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{description}</p>
                </div>
            </div>
            <ChevronDownIcon className={`w-5 h-5 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-brand-600' : ''}`} />
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Batch Processing</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">Bulk Operations</h1>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Section 1: Resident Onboarding */}
                <Card className="p-0 border-none bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm overflow-hidden">
                    <AccordionHeader 
                        id="residents"
                        title="Add Resident Users in Bulk"
                        icon={UserGroupIcon}
                        description="Account Provisioning & Unit Assignments"
                        isExpanded={expandedSection === 'residents'}
                    />
                    
                    <AnimatePresence>
                        {expandedSection === 'residents' && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="border-t border-slate-50 dark:border-white/5"
                            >
                                <div className="p-6 space-y-8">
                                    {/* Global Flow Indicator */}
                                    <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-3xl flex items-center justify-between overflow-x-auto no-scrollbar">
                                        {steps.map((s, idx) => (
                                            <React.Fragment key={s.id}>
                                                <div className="flex items-center gap-3 px-4 py-2">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                                        s.done ? 'bg-emerald-500 text-white' : (previewData.length === 0 && s.id === 1 ? 'bg-brand-600 text-white' : (previewData.length > 0 && s.id <= 2 ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'))
                                                    }`}>
                                                        {s.done ? <CheckCircleIcon className="w-5 h-5" /> : s.id}
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${s.done ? 'text-emerald-600' : 'text-slate-400'}`}>{s.label}</span>
                                                </div>
                                                {idx < steps.length - 1 && <ArrowRightIcon className="w-4 h-4 text-slate-200 shrink-0" />}
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                        {/* Stage 1 & 2: Ingestion Controls */}
                                        <div className="lg:col-span-4 space-y-6">
                                            <div className="p-6 bg-slate-50/50 dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5 space-y-8">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 text-[10px] font-black px-2 py-1 rounded">STEP 01</span>
                                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Template Sync</h3>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium mb-5 leading-relaxed">Download an Excel file configured with your community's building structure.</p>
                                                    <Button onClick={downloadTemplate} leftIcon={<ArrowDownTrayIcon />} variant="outlined" className="w-full h-11 text-[9px]">
                                                        Get Master Template
                                                    </Button>
                                                </div>

                                                <div className="pt-8 border-t border-slate-100 dark:border-white/5">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded ${previewData.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>STEP 02</span>
                                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Data Feed</h3>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium mb-5 leading-relaxed">Transmit the populated manifest to trigger automated parsing.</p>
                                                    
                                                    {!fileName ? (
                                                        <div className="relative group">
                                                            <input 
                                                                type="file" 
                                                                accept=".xlsx, .xls, .csv" 
                                                                onChange={handleFileUpload}
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                            />
                                                            <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center group-hover:border-brand-500 group-hover:bg-brand-50/10 transition-all">
                                                                <CloudArrowUpIcon className="w-10 h-10 mx-auto mb-3 text-slate-300 group-hover:text-brand-500" />
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transmit Source</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 flex flex-col items-center text-center gap-2">
                                                            <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate w-full px-2">{fileName}</p>
                                                                <button onClick={resetWizard} className="text-[9px] font-black uppercase text-rose-500 mt-2 hover:underline">Change File</button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {uploadError && (
                                                        <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl text-[10px] font-bold flex items-start gap-3">
                                                            <AlertTriangleIcon className="w-5 h-5 shrink-0" /> 
                                                            <p className="leading-relaxed">{uploadError}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stage 3: Verification & Execution */}
                                        <div className="lg:col-span-8">
                                            <div className="flex flex-col bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-3xl overflow-hidden min-h-[400px]">
                                                <div className="p-5 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.01]">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${previewData.length > 0 ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-300'}`} />
                                                        <h3 className="text-base font-brand font-extrabold text-slate-900 dark:text-slate-50">Stage 03: Verification</h3>
                                                    </div>
                                                    {previewData.length > 0 && (
                                                        <button onClick={resetWizard} className="p-2 text-slate-400 hover:text-rose-500 transition-colors" title="Discard Data">
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {previewData.length === 0 ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-10">
                                                        <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                                                            <HistoryIcon className="w-8 h-8 text-slate-200" />
                                                        </div>
                                                        <h4 className="text-lg font-brand font-extrabold text-slate-400">Awaiting Ingestion</h4>
                                                        <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto font-medium">Upload a valid manifest to populate this workspace.</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col p-6 animate-fadeIn">
                                                        <div className="flex-1 overflow-auto max-h-[400px] mb-6 rounded-2xl border border-slate-50 dark:border-white/5 shadow-inner bg-white dark:bg-black/20">
                                                            <table className="w-full text-left">
                                                                <thead className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10">
                                                                    <tr>
                                                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Member</th>
                                                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Contact</th>
                                                                        <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">Unit</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                                                    {previewData.map((row, i) => (
                                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                                            <td className="p-4 font-bold text-xs text-slate-800 dark:text-slate-200">{row['Full Name'] || row['Name']}</td>
                                                                            <td className="p-4 text-[10px] text-slate-500 font-medium">{row['Email ID'] || row['Email']}</td>
                                                                            <td className="p-4">
                                                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-600 rounded">
                                                                                    {row['Block/Tower Name'] || row['Road Name'] || ''} / {row['Flat Number'] || row['Villa Number']}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 bg-brand-50 dark:bg-brand-900/10 rounded-[2rem] border border-brand-100 dark:border-brand-900/20">
                                                            <div>
                                                                <h4 className="text-lg font-brand font-extrabold text-brand-800 dark:text-brand-300">Ready for Execution</h4>
                                                                <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold mt-1 uppercase tracking-widest">Processing {previewData.length} entities</p>
                                                            </div>
                                                            <Button onClick={processBulkCreate} disabled={isSubmitting} size="lg" className="w-full sm:w-auto h-12 px-8 shadow-xl shadow-brand-500/20" leftIcon={<CheckCircleIcon />}>
                                                                {isSubmitting ? 'Processing...' : 'Run Onboarding'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* Section 2: Placeholder for Maintenance Import */}
                <Card className="p-0 border-none bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm overflow-hidden opacity-60">
                    <AccordionHeader 
                        id="maintenance"
                        title="Import Maintenance Ledgers"
                        icon={CurrencyRupeeIcon}
                        description="Historical Payment Data Migration"
                        isExpanded={expandedSection === 'maintenance'}
                    />
                    <AnimatePresence>
                        {expandedSection === 'maintenance' && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-slate-50 dark:border-white/5 p-10 text-center"
                            >
                                <AlertTriangleIcon className="w-10 h-10 mx-auto mb-4 text-slate-300" />
                                <h4 className="text-lg font-brand font-extrabold text-slate-400">Section Locked</h4>
                                <p className="text-xs text-slate-400 mt-2 font-medium">This automated import tool is currently under development.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* Section 3: Placeholder for Notice Broadcast */}
                <Card className="p-0 border-none bg-white dark:bg-zinc-900/40 border border-slate-50 dark:border-white/5 shadow-sm overflow-hidden opacity-60">
                    <AccordionHeader 
                        id="notices"
                        title="Bulk Broadcast Notices"
                        icon={BellIcon}
                        description="Scheduled Multi-Channel Alerts"
                        isExpanded={expandedSection === 'notices'}
                    />
                    <AnimatePresence>
                        {expandedSection === 'notices' && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-slate-50 dark:border-white/5 p-10 text-center"
                            >
                                <AlertTriangleIcon className="w-10 h-10 mx-auto mb-4 text-slate-300" />
                                <h4 className="text-lg font-brand font-extrabold text-slate-400">Section Locked</h4>
                                <p className="text-xs text-slate-400 mt-2 font-medium">Bulk messaging features are arriving in the next release.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </div>

            <FeedbackModal 
                isOpen={feedback.isOpen} 
                onClose={() => setFeedback({ ...feedback, isOpen: false })} 
                title={feedback.title} 
                message={feedback.message} 
                type={feedback.type} 
            />
        </div>
    );
};

export default BulkOperations;
