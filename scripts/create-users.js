// Script para crear los usuarios iniciales de Orión Dorado
// Ejecutar: node scripts/create-users.js
//
// Antes de ejecutar, pegá la SERVICE ROLE KEY de Supabase abajo
// (Supabase Dashboard → Project Settings → API → service_role)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'TU_SUPABASE_URL';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'TU_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
  {
    email: 'admin@orioninterno.local',
    password: 'orion2026',
    name: 'admin',
    role: 'admin',
  },
  {
    email: 'vendedor1@orioninterno.local',
    password: 'neriop21',
    name: 'Vendedor 1',
    role: 'vendedor',
  },
  {
    email: 'vendedor2@orioninterno.local',
    password: 'neriop21',
    name: 'Vendedor 2',
    role: 'vendedor',
  },
];

async function createUsers() {
  for (const user of users) {
    console.log(`Creando usuario: ${user.name}...`);

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    });

    if (error) {
      console.error(`  ✗ Error: ${error.message}`);
    } else {
      console.log(`  ✓ Usuario creado: ${data.user.id}`);
    }
  }

  console.log('\nListo. Podés iniciar sesión con:');
  console.log('  admin    / orion2026');
  console.log('  vendedor1 / neriop21');
  console.log('  vendedor2 / neriop21');
}

createUsers();
