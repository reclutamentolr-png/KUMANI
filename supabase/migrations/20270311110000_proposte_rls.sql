-- Proposte: le regole di lettura non chiamano admin_is_staff (non eseguibile
-- dagli utenti). Lo Staff legge tutto dal pannello con il client di servizio.
drop policy if exists community_proposals_read on public.community_proposals;
create policy community_proposals_read on public.community_proposals for select to authenticated
  using (status in ('open', 'review', 'planned', 'done', 'declined') or author_id = auth.uid());
drop policy if exists community_proposal_reports_staff on public.community_proposal_reports;
