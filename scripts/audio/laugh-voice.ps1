# Syllabes du rire diabolique, dites par la synthèse vocale locale de Windows (System.Speech, voix
# « Microsoft Paul », fr-FR, masculine) : « Mouaaah » long et grave, puis un « Ha ! » court.
# Elles sont ensuite assemblées et retravaillées par laugh.mjs (aucun fichier téléchargé).
# Usage : powershell -File scripts/audio/laugh-voice.ps1 <dossier de sortie>
param([string]$out = ".")
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Paul")
$pieces = @{
  "moua" = '<prosody pitch="x-low" rate="x-slow">Mouaaaaah</prosody>'
  "ha"   = '<prosody pitch="low" rate="fast">Ha !</prosody>'
}
foreach ($k in $pieces.Keys) {
  $s.SetOutputToWaveFile((Join-Path $out "laugh-$k.wav"))
  $s.SpeakSsml('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">' + $pieces[$k] + '</speak>')
  $s.SetOutputToNull()
}
