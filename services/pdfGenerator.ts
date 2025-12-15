
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CommunityStat, FinancialHistory } from "../types";
import type { MonthlyLedger } from "./api";

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

export const generateLedgerReport = (data: MonthlyLedger, month: string, year: number, communityName: string) => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();
    
    // Month handling
    const dateObj = new Date(year, parseInt(month) - 1, 1);
    const monthName = dateObj.toLocaleString('default', { month: 'long' });

    const brandColor = [20, 184, 166]; // RGB for Teal
    const darkColor = [31, 41, 55]; // Gray 800

    // 1. Header Banner
    doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Branding
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("Elevate", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Community Management Platform", 14, 32);

    // Report Title in Banner
    doc.setFontSize(22);
    doc.text("MONTHLY LEDGER", 196, 25, { align: 'right' });
    doc.setFontSize(12);
    doc.text(`${monthName.toUpperCase()} ${year}`, 196, 32, { align: 'right' });

    // 2. Info Section
    const startY = 55;
    
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(communityName, 14, startY);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Report Generated: ${dateStr}`, 14, startY + 6);

    // 3. Summary Cards (Rounded Rectangles)
    // Card Y Position
    const cardY = startY + 15;
    const cardWidth = 55;
    const cardHeight = 25;
    const gap = 10;

    // Card 1: Collected
    doc.setFillColor(240, 253, 244); // Green 50
    doc.setDrawColor(220, 252, 231); // Green 100
    doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    
    doc.setFontSize(9);
    doc.setTextColor(22, 163, 74); // Green 600
    doc.text("TOTAL COLLECTED", 14 + 5, cardY + 8);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${data.collectedThisMonth.toLocaleString()}`, 14 + 5, cardY + 18);

    // Card 2: Expenses
    doc.setFillColor(254, 242, 242); // Red 50
    doc.setDrawColor(254, 226, 226); // Red 100
    doc.roundedRect(14 + cardWidth + gap, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38); // Red 600
    doc.text("TOTAL EXPENSES", 14 + cardWidth + gap + 5, cardY + 8);

    doc.setFontSize(14);
    doc.text(`Rs. ${data.expensesThisMonth.toLocaleString()}`, 14 + cardWidth + gap + 5, cardY + 18);

    // Card 3: Pending
    doc.setFillColor(255, 251, 235); // Amber 50
    doc.setDrawColor(254, 243, 199); // Amber 100
    doc.roundedRect(14 + (cardWidth + gap) * 2, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(217, 119, 6); // Amber 600
    doc.text("PENDING DUES", 14 + (cardWidth + gap) * 2 + 5, cardY + 8);

    doc.setFontSize(14);
    doc.text(`Rs. ${data.pendingThisMonth.toLocaleString()}`, 14 + (cardWidth + gap) * 2 + 5, cardY + 18);


    // 4. Ledger Table
    const tableStartY = cardY + cardHeight + 15;

    // Formatting helper
    const formatCurrency = (amount: number, prefix = '') => {
        return `${prefix} Rs. ${amount.toLocaleString()}`;
    };

    const tableBody = [
        ['Opening Balance', '(Carry forward from previous month)', formatCurrency(data.previousBalance)],
        ['+ Inflow', `Maintenance collected in ${monthName}`, formatCurrency(data.collectedThisMonth)],
        ['- Outflow', `Expenses approved in ${monthName}`, formatCurrency(data.expensesThisMonth)],
        ['= Closing Balance', `Available funds at end of ${monthName}`, formatCurrency(data.closingBalance)],
    ];

    autoTable(doc, {
        startY: tableStartY,
        head: [['Category', 'Description', 'Amount']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
            fillColor: [243, 244, 246], // Gray 100
            textColor: [55, 65, 81],   // Gray 700
            fontStyle: 'bold',
            lineWidth: 0
        },
        styles: { 
            fontSize: 11, 
            cellPadding: 6,
            textColor: [55, 65, 81],
            lineColor: [229, 231, 235], // Gray 200
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 'auto' }, // Description takes remaining space
            2: { cellWidth: 50, halign: 'right' }
        },
        didParseCell: function(data) {
            // Styling logic
            const rowIdx = data.row.index;
            const colIdx = data.column.index;

            // Inflow Row Amount
            if (rowIdx === 1 && colIdx === 2) {
                data.cell.styles.textColor = [22, 163, 74]; // Green
            }
            // Outflow Row Amount
            if (rowIdx === 2 && colIdx === 2) {
                data.cell.styles.textColor = [220, 38, 38]; // Red
            }
            // Closing Balance Row
            if (rowIdx === 3) {
                data.cell.styles.fillColor = [20, 184, 166]; // Teal 500
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // --- Footer ---
    const pageHeight = doc.internal.pageSize.height;
    
    doc.setDrawColor(229, 231, 235);
    doc.line(14, pageHeight - 20, 196, pageHeight - 20);
    
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175); // Gray 400
    doc.text("System Generated Report • Elevate Community Manager", 105, pageHeight - 12, { align: 'center' });

    doc.save(`Ledger_${monthName}_${year}.pdf`);
}
