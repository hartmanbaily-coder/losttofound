update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
  'text/plain',
  'text/csv',
  'text/html'
]
where id = 'records-evidence';
