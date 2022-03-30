console.log(JSON.stringify({
  name: "getMatch",
  description: "Get match data from HLTV",
  options: [
    {
      type: 4, // Integer
      name: "matchId",
      description: "The match id",
      required: true
    }
  ]
}))