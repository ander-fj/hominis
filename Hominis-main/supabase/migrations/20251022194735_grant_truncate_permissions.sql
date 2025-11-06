/*
  # Permissões para função de limpeza de dados

  1. Permissões
    - Permite usuários anônimos executarem a função truncate_all_data()
*/

GRANT EXECUTE ON FUNCTION truncate_all_data() TO anon;
GRANT EXECUTE ON FUNCTION truncate_all_data() TO authenticated;