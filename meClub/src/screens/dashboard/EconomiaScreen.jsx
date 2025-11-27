import React from 'react';
import { View, Text } from 'react-native';
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query"
import { getClubSummary, api } from "../../lib/api"
import { useAuth } from '../../features/auth/useAuth';



async function getUser() {
  //llama a un endpoint del backend que le devuelve la información del usuario
  const data = await api.get("/usuarios/perfil") // endpoint del back
  return data.usuario
}

const getClubSummaryQueryOptions = (user) => queryOptions({
  queryKey: ["summary", user],
  queryFn: async () => await getClubSummary({ clubId: user.clubId })
})

export default function EconomiaScreen({ summary = {} }) {
  const { user } = useAuth()

  const { data, isPending, error } = useQuery({
    ...getClubSummaryQueryOptions(user), // { clubId: 2 }
    select: (data) => `$${Number(data?.economiaMes ?? 0).toLocaleString('es-AR')}`,
  });

  return (
    <View className="flex-1">
      <View className="py-6">
        <Text className="text-white text-[36px] font-extrabold tracking-tight">Economía</Text>
        <Text className="text-white/60 mt-1">Resumen económico del club</Text>
      </View>
      <View className="gap-6">
        <View className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <Text className="text-white/70 text-[14px] uppercase tracking-[0.2em]">
            Ingresos del mes
          </Text>
          {!error 
            ? <Text className="text-white text-[40px] font-extrabold mt-3">{isPending ? "Loading..." : data}</Text> 
            : <Text className="text-white text-[40px] font-extrabold mt-3">OCURRIO UN ERROR</Text>}
          <Text className="text-white/50 mt-2">
            Mantén al día tus registros económicos y controla la salud financiera del club.
          </Text>
        </View>
      </View>
    </View>
  );
}
