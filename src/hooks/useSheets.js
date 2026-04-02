import { useState, useEffect } from 'react';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS } from '../utils/mockData';

/**
 * Hook to manage data from Google Sheets.
 * Currently uses mock data. To integrate with real Sheets:
 * 1. Set up a Google Apps Script to serve as a web app.
 * 2. Update the API_ENDPOINT.
 */
const useSheets = (sheetName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate API fetch delay
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fallback to mock data based on sheetName
        let initialData = [];
        if (sheetName === 'PRODUCTOS') initialData = MOCK_PRODUCTS;
        if (sheetName === 'CLIENTES') initialData = MOCK_CUSTOMERS;
        
        setData(initialData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sheetName]);

  const addRow = async (rowData) => {
    console.log(`Adding to ${sheetName}:`, rowData);
    setData(prev => [...prev, { id: Date.now().toString(), ...rowData }]);
    // Here you would call fetch(API_ENDPOINT, { method: 'POST', body: JSON.stringify(rowData) })
  };

  const updateRow = async (id, updatedData) => {
    console.log(`Updating ${sheetName} ID ${id}:`, updatedData);
    setData(prev => prev.map(row => row.id === id ? { ...row, ...updatedData } : row));
  };

  return { data, loading, error, addRow, updateRow };
};

export default useSheets;
