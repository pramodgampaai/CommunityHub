
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CommunityStat, FinancialHistory } from "../types";

export const generateInvoice = (stat: CommunityStat) => {
    const doc = new jsPDF();
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString();
    
    // Generate Invoice Number (e.g., INV-202310-COMM123)
    const invoiceNumber = `INV-${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}-${stat.id.substring(0, 6).toUpperCase()}`;

    // --- Header ---
    doc.setFontSize(22);
    doc.setTextColor(20, 184, 166); // Brand Teal
    doc.text("Elevate", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Community Management Platform", 14, 25);
    doc.text("billing@elevate.com", 14, 30);

    // --- Invoice Details (Top Right) ---
    doc.setFontSize(26);
    doc.setTextColor(200);
    doc.text("INVOICE", 140, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(`Invoice No:`, 140, 35);
    doc.text(invoiceNumber, 170, 35);
    
    doc.text(`Date:`, 140, 40);
    doc.text(dateStr, 170, 40);

    doc.text(`Due Date:`, 140, 45);
    doc.text(dateStr, 170, 45); // Due immediately

    // --- Bill To ---
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Bill To:", 14, 55);
    
    doc.setFontSize(11);
    doc.text(stat.name, 14, 62);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const addressLines = doc.splitTextToSize(stat.address, 80);
    doc.text(addressLines, 14, 67);

    // --- Calculations ---
    const residentPrice = stat.pricePerUser?.resident || 0;
    const adminPrice = stat.pricePerUser?.admin || 0;
    const staffPrice = stat.pricePerUser?.staff || 0;

    const residentTotal = stat.resident_count * residentPrice;
    const adminTotal = stat.admin_count * adminPrice;
    const staffTotal = stat.staff_count * staffPrice;
    const grandTotal = residentTotal + adminTotal + staffTotal;

    // --- Table Data ---
    const tableBody = [
        ['Active Residents', stat.resident_count, `Rs. ${residentPrice.toLocaleString()}`, `Rs. ${residentTotal.toLocaleString()}`],
        ['Community Admins', stat.admin_count, `Rs. ${adminPrice.toLocaleString()}`, `Rs. ${adminTotal.toLocaleString()}`],
        ['Staff (Security & Helpdesk)', stat.staff_count, `Rs. ${staffPrice.toLocaleString()}`, `Rs. ${staffTotal.toLocaleString()}`],
    ];

    // --- Draw Table ---
    autoTable(doc, {
        startY: 90,
        head: [['Description', 'Quantity', 'Unit Price', 'Total']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166] }, // Brand Teal
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 80 },
            3: { halign: 'right' }
        }
    });

    // --- Totals ---
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY || 130;
    
    doc.setFontSize(10);
    doc.text("Subtotal:", 140, finalY + 10);
    doc.text(`Rs. ${grandTotal.toLocaleString()}`, 195, finalY + 10, { align: 'right' });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Total:", 140, finalY + 20);
    doc.text(`Rs. ${grandTotal.toLocaleString()}`, 195, finalY + 20, { align: 'right' });

    // --- Footer ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("Thank you for choosing Elevate.", 14, 280);
    doc.text("This is a system generated invoice.", 14, 285);

    // Save
    doc.save(`Elevate_Invoice_${stat.name.replace(/\s+/g, '_')}_${dateStr}.pdf`);
};

export const generateAnnualReport = (data: FinancialHistory) => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();

    // Header
    doc.setFontSize(24);
    doc.setTextColor(20, 184, 166);
    doc.text("Elevate Annual Financial Report", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`Fiscal Year: ${data.year}`, 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${dateStr}`, 14, 35);

    // Grand Total
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`Total Revenue Collected: Rs. ${data.totalCollected.toLocaleString()}`, 14, 50);

    // Monthly Table
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Monthly Breakdown", 14, 65);

    autoTable(doc, {
        startY: 70,
        head: [['Month', 'Transactions', 'Collected Amount']],
        body: data.monthlyBreakdown.map(m => [m.month, m.transactionCount, `Rs. ${m.amount.toLocaleString()}`]),
        theme: 'striped',
        headStyles: { fillColor: [20, 184, 166] },
        foot: [['Total', '-', `Rs. ${data.totalCollected.toLocaleString()}`]]
    });

    // Community Table
    // @ts-ignore
    const secondTableY = doc.lastAutoTable.finalY + 20;
    
    doc.setFontSize(12);
    doc.text("Community Breakdown", 14, secondTableY - 5);

    autoTable(doc, {
        startY: secondTableY,
        head: [['Community Name', 'Total Contributed']],
        body: data.communityBreakdown.map(c => [c.communityName, `Rs. ${c.totalPaid.toLocaleString()}`]),
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81] } // Gray 700
    });

    doc.save(`Elevate_Annual_Report_${data.year}.pdf`);
};
