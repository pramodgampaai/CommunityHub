import React, { useState, useEffect } from 'react';
import { getCommunity, bulkCreateCommunityUsers } from '../services/api';
import type { Community, Block } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import FeedbackModal from '../components/ui/FeedbackModal';
import { useAuth } from '../hooks/useAuth';
import { ArrowDownTrayIcon, AlertTriangleIcon, CheckCircleIcon, HistoryIcon } from '../components/icons';

// Using ExcelJS for advanced features like native Data Validation (Dropdowns)
import ExcelJS from 'https://esm.sh/exceljs@4.4.0';
// Keep xlsx for simple parsing on upload
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const BulkOperations: React.FC = () => {
    const { user } = useAuth();
    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    
    const [feedback, setFeedback] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        isOpen: false, type: 'info', title: '', message: ''
    });

    useEffect(() => {
        const init = async () => {
            if (!user?.communityId) return;
            try {
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
        anchor.download = `Elevate_Template_${community.name.replace(/\s+/g, '_')}.xlsx`;
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
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { raw: false });
                
                if (data.length === 0) {
                    setUploadError("The uploaded file is empty.");
                    return;
                }

                const firstRow: any = data[0];
                const hasName = firstRow['Full Name'] || firstRow['Name'];
                if (!hasName) {
                    setUploadError("Invalid template format. Please ensure 'Full Name' exists.");
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
                setUploadError("Failed to parse file. Please use the provided template.");
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
            setFeedback({ isOpen: true, type: 'success', title: 'Operation Successful', message: `Successfully onboarded ${usersPayload.length} residents.` });
            setPreviewData([]);
        } catch (err: any) {
            console.error(err);
            setFeedback({ isOpen: true, type: 'error', title: 'Bulk Creation Failed', message: err.message || "An error occurred." });
        } finally { setIsSubmitting(false); }
    };

    if (loading) return <div className="h-96 flex items-center justify-center"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Admin Management</span>
                        <h2 className="text-3xl font-brand font-extrabold text-brand-600 dark:text-slate-50 tracking-tight leading-tight">Bulk Operations</h2>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border-none bg-white dark:bg-zinc-900/40 animated-card flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-brand-50 dark:bg-brand-500/10 rounded-xl text-brand-600">
                            <ArrowDownTrayIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight">1. Get Dynamic Template</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Custom layout logic</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 flex-grow leading-relaxed">
                        Download a smart Excel file pre-configured for your **{community?.communityType}**. Includes dropdown menus for Towers/Roads.
                    </p>
                    <Button onClick={downloadTemplate} size="lg" className="w-full" leftIcon={<ArrowDownTrayIcon />}>
                        Download Excel Template
                    </Button>
                </Card>

                <Card className="p-6 border-none bg-white dark:bg-zinc-900/40 animated-card flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-brand-50 dark:bg-brand-500/10 rounded-xl text-brand-600">
                            <CloudArrowUpIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-brand font-extrabold text-slate-900 dark:text-slate-50 leading-tight">2. Upload & Commit</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Bulk Resident Import</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 flex-grow leading-relaxed">
                        Upload your completed spreadsheet to preview the data before finalizing the onboarding.
                    </p>
                    <div className="relative">
                        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <Button variant="outlined" size="lg" className="w-full pointer-events-none" leftIcon={<CloudArrowUpIcon />}>
                            Select File to Upload
                        </Button>
                    </div>
                </Card>
            </div>

            {uploadError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 animate-fadeIn">
                    <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-wide">{uploadError}</p>
                </div>
            )}

            {previewData.length > 0 && (
                <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-black text-brand-600 dark:text-brand-400 font-mono uppercase tracking-[0.3em]">Manifest Preview ({previewData.length} entries)</h3>
                        <button onClick={() => setPreviewData([])} className="text-[10px] font-bold text-rose-500 uppercase hover:underline flex items-center gap-1">
                            <TrashIcon className="w-3.5 h-3.5" /> Clear All
                        </button>
                    </div>
                    
                    <Card className="p-0 border border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-premium">
                        {/* DESKTOP TABLE VIEW */}
                        <div className="hidden md:block overflow-x-auto max-h-[500px] no-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10">
                                    <tr>
                                        {Object.keys(previewData[0]).map(h => (
                                            <th key={h} className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap border-b border-slate-100 dark:border-white/5">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                            {Object.values(row).map((val: any, vIdx) => (
                                                <td key={vIdx} className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{val}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE CARD VIEW */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-white/5 max-h-[500px] overflow-y-auto no-scrollbar">
                            {previewData.map((row, idx) => (
                                <div key={idx} className="p-5 space-y-3 bg-white dark:bg-transparent">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 flex items-center justify-center font-brand font-black text-sm">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{row['Full Name'] || row['Name']}</p>
                                            <p className="text-[10px] font-medium text-slate-400 truncate">{row['Email ID'] || row['Email']}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        {Object.entries(row)
                                            .filter(([k]) => !['Full Name', 'Name', 'Email ID', 'Email', 'Password'].includes(k))
                                            .map(([key, val]) => (
                                                <div key={key} className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 truncate">{key}</p>
                                                    <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 truncate">{String(val)}</p>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* STICKY FOOTER ACTION */}
                        <div className="p-6 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                                <InformationCircleIcon className="w-4 h-4 shrink-0" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-center sm:text-left">Ensure data integrity before authorizing onboarding.</p>
                            </div>
                            <Button onClick={processBulkCreate} disabled={isSubmitting} size="lg" className="w-full sm:w-auto shadow-xl shadow-brand-500/20" leftIcon={<CheckCircleIcon />}>
                                {isSubmitting ? 'Onboarding...' : `Commit ${previewData.length} Records`}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <div className="flex flex-col items-center pt-8 opacity-30 pb-4">
                <p className="text-[8px] font-mono font-black uppercase tracking-[0.6em]">System Operations Engine v2.1</p>
            </div>

            <FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} title={feedback.title} message={feedback.message} type={feedback.type} />
        </div>
    );
};

const CloudArrowUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
    </svg>
);

const InformationCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
);

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

export default BulkOperations;