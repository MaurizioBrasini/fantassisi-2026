// lib/config.ts

export const CONFIG_ISCRIZIONE = {
  // Lista di tutte le scuole (solo acronimi/nomi, senza città)
  scuole: [
    'APC',
    'AIPC',
    'CCMA',
    'IGB',
    'SICC',
    'SPC'
  ],
  
  // Sedi disponibili
  sedi: [
    'Ancona',
    'Bari', 
    'Grosseto',
    "L'Aquila",
    'Lecce',
    'Napoli',
    'Palermo',
    'Reggio Calabria',
    'Romania',
    'Roma',
    'Verona'
  ],
  
  // Relazione Sede → Scuole
  scuolePerSede: {
    'Ancona': ['SPC'],
    'Bari': ['AIPC'],
    'Grosseto': ['SPC'],
    "L'Aquila": ['SICC'],
    'Lecce': ['APC'],
    'Napoli': ['SPC'],
    'Palermo': ['IGB'],
    'Reggio Calabria': ['SPC'],
    'Romania': ['APC'],
    'Roma': ['APC', 'CCMA', 'SICC', 'SPC'],
    'Verona': ['APC', 'SPC']
  },
  
  // Relazione Scuola → Sedi (per validazione)
  sediPerScuola: {
    'APC': ['Lecce', 'Roma', 'Verona', 'Romania'],
    'AIPC': ['Bari'],
    'CCMA': ['Roma'],
    'IGB': ['Palermo'],
    'SICC': ["L'Aquila", 'Roma'],
    'SPC': ['Ancona', 'Grosseto', 'Napoli', 'Reggio Calabria', 'Roma', 'Verona']
  },
  
  anni: [
    { value: '', label: 'Non specificato' },
    { value: 'preiscrizione', label: 'Pre-iscrizione (2027/2028)' },
    { value: 'primo', label: '1° Anno' },
    { value: 'secondo', label: '2° Anno' },
    { value: 'terzo', label: '3° Anno' },
    { value: 'quarto', label: '4° Anno' },
    { value: 'specializzato', label: 'Specializzato' }
  ],
  
  // Vincoli Team → Anni (FILTRO OBBLIGATORIO)
  teamAnniValid: {
    'Matricole': ['preiscrizione', 'primo', 'secondo'],
    'Veterani': ['terzo', 'quarto', 'specializzato'],
    'Didatti&Docenti': ['preiscrizione', 'primo', 'secondo', 'terzo', 'quarto', 'specializzato'],
    '': ['preiscrizione', 'primo', 'secondo', 'terzo', 'quarto', 'specializzato'] // nessun team
  }
};