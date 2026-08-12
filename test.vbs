Dim jrePath: jrePath="java.exe"  
Dim cpPath: cpPath="lib"  
Dim cmd : cmd = Chr(34) & jrePath & Chr(34) & " -cp " & Chr(34) & cpPath & Chr(34) & " agent.MldAgent"  
WScript.Echo cmd  
