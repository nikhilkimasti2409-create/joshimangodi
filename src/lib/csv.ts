// RFC 4180 CSV Generator and VCF Contact Parser

export function toRFC4180CSV(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n'); // Include UTF-8 BOM
}

export function downloadFile(filename: string, content: string, mimeType: string = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedContact {
  name: string;
  phone: string;
  type: 'retail' | 'wholesale';
  area?: string;
}

export function parseVCFText(vcfText: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const cards = vcfText.split(/BEGIN:VCARD/i);

  for (const card of cards) {
    if (!card.trim()) continue;
    
    let name = '';
    let phone = '';
    let area = '';

    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('FN:')) {
        name = line.substring(3).trim();
      } else if (!name && line.startsWith('N:')) {
        const parts = line.substring(2).split(';').filter(Boolean);
        name = parts.reverse().join(' ').trim();
      } else if (line.startsWith('TEL')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const rawNum = line.substring(colonIdx + 1).replace(/[^\d+]/g, '');
          if (rawNum.length >= 10 && !phone) {
            phone = rawNum;
          }
        }
      } else if (line.startsWith('ORG:')) {
        area = line.substring(4).trim();
      }
    }

    if (name && phone) {
      contacts.push({
        name,
        phone,
        type: area.toLowerCase().includes('wholes') || name.toLowerCase().includes('pvt') || name.toLowerCase().includes('fmcg') ? 'wholesale' : 'retail',
        area: area || undefined,
      });
    }
  }

  return contacts;
}

export function parseCSV(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, ''); // Strip BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // Skip \n
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}
