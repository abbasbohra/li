import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { s } from '../styles';

export default function Search({ onOpen }) {
  const [rows, setRows] = useState([]);
  async function find(q) {
    if (q.length < 2) return setRows([]);
    const { data } = await supabase.from('products').select('id,sku,name,price,stock')
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%,category.ilike.%${q}%`).limit(20);
    setRows(data || []);
  }
  return (
    <View style={s.screen}>
      <TextInput style={s.input} placeholder="Search name / SKU / category" onChangeText={find} />
      <FlatList data={rows} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => onOpen(item.id)}>
          <Text style={s.title}>{item.name}</Text>
          <Text>{item.sku}  •  ₹{item.price}  •  Stock: {item.stock}</Text>
        </TouchableOpacity>
      )} />
    </View>
  );
}
