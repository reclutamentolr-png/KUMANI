-- Privacy dei Kumani, parte 2: da applicare DOPO il deploy del codice che
-- usa get_my_profile / get_my_downline / get_my_sponsor / get_network_leaderboard
-- e le azioni Staff (adminListMatrixUsers, adminGetUserMatrix, ...).
--
-- Gli utenti loggati non leggono più cognome, codice unico e username degli
-- altri con una select diretta su profiles. Il proprio profilo completo si
-- legge con get_my_profile(); i dati degli altri arrivano solo dalle
-- funzioni dedicate (nome, codice mascherato dove serve).
revoke select (last_name, referral_code, username) on public.profiles from authenticated;

-- Matrice di un utente qualsiasi: solo per lo Staff, dal server
-- (adminGetUserMatrix). Prima qualunque utente loggato poteva leggere la
-- rete di chiunque passando un id.
revoke all on function public.get_user_downline(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_user_downline(uuid, integer) to service_role;
