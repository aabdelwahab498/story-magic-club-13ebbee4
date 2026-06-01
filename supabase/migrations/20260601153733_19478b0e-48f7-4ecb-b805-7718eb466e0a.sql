UPDATE public.payment_settings
   SET instapay_enabled  = true,
       instapay_handle   = COALESCE(NULLIF(instapay_handle, ''), 'najmah@instapay'),
       vodafone_enabled  = true,
       vodafone_number   = COALESCE(NULLIF(vodafone_number, ''), '+201000000000'),
       payoneer_enabled  = true,
       payoneer_email    = COALESCE(NULLIF(payoneer_email, ''), 'payments@najmah.app'),
       bank_enabled      = true,
       bank_name         = COALESCE(NULLIF(bank_name, ''), 'CIB - Commercial International Bank'),
       bank_account_name = COALESCE(NULLIF(bank_account_name, ''), 'Najmah for Digital Services'),
       bank_account_number = COALESCE(NULLIF(bank_account_number, ''), '100000000000'),
       bank_iban         = COALESCE(NULLIF(bank_iban, ''), 'EG000000000000000000000000000'),
       bank_swift        = COALESCE(NULLIF(bank_swift, ''), 'CIBEEGCX'),
       updated_at        = now();