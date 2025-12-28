
import React, { useState, useEffect } from 'react';
import { getCommunity, bulkCreateCommunityUsers } from '../services/api';
import type { Community, Block } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import FeedbackModal from '../components/ui/FeedbackModal';
import { useAuth } from '../hooks/useAuth';
import { ArrowDownTrayIcon, AlertTriangleIcon, CheckCircleIcon, HistoryIcon, CloudArrowUpIcon, TrashIcon } from '../components/icons';

// Using bare imports to leverage importmap
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

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

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Spinner />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div className="flex items-start gap-2.5">
                    <div className="w-1 h-10 bg-brand-500 rounded-full mt-1" />
                    <div>
                        <span className="text-[8px] font-mono font-black uppercase tracking-[0.3em] text-brand-600 dark:text-brand-400 mb-0.5 block">Admin Tools</span>
                        <h1 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight">Bulk Operations</h1>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-bold mb-2">1. Download Template</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Get the standardized Excel template pre-configured with your community's block and floor structure.
                        </p>
                        <Button onClick={downloadTemplate} leftIcon={<ArrowDownTrayIcon />} variant="outlined" className="w-full">
                            Download XLSX Template
                        </Button>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                        <h3 className="text-lg font-bold mb-2">2. Upload Resident Data</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Upload the completed template to preview and process the bulk onboarding.
                        </p>
                        <div className="relative group">
                            <input 
                                type="file" 
                                accept=".xlsx, .xls, .csv" 
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center group-hover:border-brand-500 transition-colors">
                                <CloudArrowUpIcon className="w-10 h-10 mx-auto mb-2 text-slate-400 group-hover:text-brand-500" />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Excel File</p>
                            </div>
                        </div>
                        {uploadError && (
                            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertTriangleIcon className="w-4 h-4" /> {uploadError}
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Preview & Process</h3>
                        {previewData.length > 0 && (
                            <button onClick={() => setPreviewData([])} className="text-rose-500 hover:text-rose-600">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {previewData.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30 py-12">
                            <HistoryIcon className="w-12 h-12 mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Waiting for upload...</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-auto max-h-[400px] mb-6 rounded-xl border border-slate-100 dark:border-white/5">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-slate-50 dark:bg-white/5 sticky top-0">
                                        <tr>
                                            <th className="p-2 font-black uppercase tracking-widest text-slate-400">Name</th>
                                            <th className="p-2 font-black uppercase tracking-widest text-slate-400">Email</th>
                                            <th className="p-2 font-black uppercase tracking-widest text-slate-400">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                        {previewData.map((row, i) => (
                                            <tr key={i}>
                                                <td className="p-2 font-bold">{row['Full Name'] || row['Name']}</td>
                                                <td className="p-2 text-slate-500">{row['Email ID'] || row['Email']}</td>
                                                <td className="p-2 text-brand-600 font-bold">
                                                    {row['Block/Tower Name'] || row['Road Name'] || ''}-{row['Flat Number'] || row['Villa Number']}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-brand-50 dark:bg-brand-900/20 rounded-2xl mb-4 border border-brand-100 dark:border-brand-900/30">
                                <p className="text-xs font-bold text-brand-800 dark:text-brand-300">Ready to process {previewData.length} records.</p>
                                <p className="text-[10px] text-brand-600 dark:text-brand-400 mt-1">This will create user accounts and initial maintenance ledgers.</p>
                            </div>
                            <Button onClick={processBulkCreate} disabled={isSubmitting} size="lg" className="w-full" leftIcon={<CheckCircleIcon />}>
                                {isSubmitting ? 'Onboarding Residents...' : 'Confirm Bulk Onboarding'}
                            </Button>
                        </div>
                    )}
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
