select o.*, group_concat(opn.number, ', ') as phone_numbers
from objects o
inner join object_phone_numbers opn on o.id = opn.object_id
group by o.id
