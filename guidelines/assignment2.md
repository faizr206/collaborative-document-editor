# Assignment2: Implementation

## Collab orativeDo cumentEditorwithAIWritingAssistant

```
April 2026
```
## Overview

InAssignment1,yourteamdesignedthearchitecture,requirements,anddatamo delforareal-timecollab orative
do cumenteditorwithanAIwritingassistant.Nowyoubuildit.

Thisassignmentisab outturning yourdesign into working softwareusingaReactfrontendanda
FastAPIbackend,withJWT-basedauthenticationandstreamingresp onsesfortheAIassistant.The
implementationmustb econsistentwithyourAssignment 1 architectureor,whereyoudeviate,youmust
do cumentwhatchangedandwhy.

Thisdo cumentdescrib esthebaselinefeatureseveryteammustimplement. Beyondthese,implementthe
additionalfeaturesfromyourAssignment 1 design. Thebaselineensuresacommonfoundation;yourdesign
determinesthefullscop e.

## TechnologyConstraints

Frontend:React
AnyReactmeta-framework(Next.js,Vite+React,etc.) andstatemanagementapproach. Typ eScriptis
stronglyrecommended.
Backend:FastAPI
AnyadditionalPythonlibrariesyouseet. Adatabaseisnotrequiredin-memorystorageorle-based
p ersistence(e.g.,JSONles)isacceptable.Ifyouuseadatabase,justifythatchoice.
Authentication:JWT
Tokenissuance,validation,andrefresh.Youmayusealibrary(e.g.,python-jose,PyJWT)butmustunderstand
andexplainthetokenlifecycle.
AIStreaming:SSEorWebSo cket
AIresp onsesmustb estreamedtoken-by-tokentotheclientviaSSE(text/event-stream),WebSo cketmes-
sages,orchunkedHTTPresp onses.

Youarefreetocho oseanyadditionallibraries.Justifysignicantchoicesinyourdo cumentation.

## Part1: CoreApplication(25%)

Thefollowingarebaselinefeatureseveryteammustimplement. Beyondthese,implementtheadditional
featuresfromyourAssignment 1 design.

1.1Authentication& SessionsRegistrationandloginwithsecurelyhashedpasswords(plaintext=
automaticzero). JWTaccesstokens(short-lived,1530min)andrefreshtokensforsilentre-authentication.
AllAPIendp ointsrequireauthentication.Sessionp ersistsacrosspagerefreshes. Thefrontendhandlestoken
expirationgracefullynoraw 401 errorsduringediting.

1.2Do cumentManagementDo cumentCRUDwithmetadata(title,dates,owner). Dashb oardlisting
do cumentstheuserownsorhasaccessto. Rich-texteditorsupp ortingatminimumheadings, b old,italic,
lists,andco deblo cks(usealibrary:Tiptap,Slate,ProseMirror,Quill,etc.).Auto-savewithstatusindication.
Versionhistorywiththeabilitytorestorepreviousversions.

1.3AccessControl&SharingAtleastthreeroles:owner,editor,viewer.Ownersshareanddelete;
editorsmo difycontentandinvokeAI;viewersreadonly. Sharingbyemail/usernamewithroleassignment.
Permissionenforcementmustb eserver-sidehidingabuttonisnotaccesscontrol.Aviewerwhocrafts
adirectAPIrequestmuststillb eblo cked.

## Part2: Real-TimeCollab oration(20%)

Thefollowingarebaselinerequirements. Beyondthese,implementthecollab orationfeaturesfromyour
Assignment 1 design.


2.1ConcurrentEditingChangespropagatetootherusers'screenswithinareasonablelatency(target:
<500msonlo calnetwork). Youmayuseanylibraryorrollyourownbutmustdemonstrateunderstanding
ofhowitworks. [Bonus]Conict resolution: Prop ercharacter-levelconictresolution(CRDTs,OT)is
b onus-tier. Abasiclast-write-winsorsimplemergeapproachisacceptableforthebaseline. Handlethefull
connectionlifecycle:initialload,joiningactivesessions,disconnection/reconnection,andstatereconciliation.

2.2Presence&AwarenessActiveuserindicatorsshowingwhoisonline.[Bonus]Cursorandselection
tracking:Renderingremotecursorsandselectionsinrealtimeisb onus-tier;abasicwhoisonlinelististhe
baseline.Typingindicatorsoractivitystatusforremoteusers.

2.3WebSo cketTransp ortAuthenticatedWebSo cketconnections(novalidtoken=nosession).Explain
yourserver-sidesyncsetupandmessageproto col.Gracefuldegradation:oineeditingwithsynconreconnect.

## Part3: AIWritingAssistant(25%)

ThefollowingarebaselineAIfeatures. Beyondthese,implementanyadditionalAIcapabilitiesfromyour
Assignment 1 design.

3.1AIFeaturesImplementatleasttwoofthefollowing,plusanyadditionalfeaturesfromyourAs-
signment 1 design:Rewrite/Rephrase(withtone/styleoptions),Summarize(withlength/formatoptions),
Translate(preservingformatting),Expand/Elab orate,FixGrammar&Sp elling,CustomPrompt
(free-forminstructiononselectedtext).

3.2StreamingHardrequirement.UseFastAPI'sStreamingResponseorWebSo cketmessages.Frontend
renderstextprogressivelyaschunksarrive.Usercancancelin-progressgeneration.Errorsmid-streamshowa
clearmessage;partialoutputiseitherpreservedwithanindicatororcleanlydiscarded.

3.3SuggestionUXAIoutputmustlettheusercompareoriginalvs.suggestionb eforeapplying(side
panel,inlinedi,trackedchanges,etc.).Accept/reject/editthesuggestion.Undoafteracceptance.Do cument
yourstrategyforAIsuggestionsduringconcurrentcollab oration.

3.4Context&PromptsSendappropriatecontexttotheLLM,nottheentiredo cumentblindly.Handle
longdo cumentswithtruncation/chunking. Prompttemplatesmustb econgurable(conglesoraprompt
mo dule),nothardco ded.AbstracttheLLMproviderb ehindaninterfaceswappingprovidersshouldrequire
changesinoneplace.

3.5AIInteraction HistoryLogeveryAIinteraction(input,prompt,mo del,resp onse,accept/reject
status).ProvideahistoryUIforeachdo cument.Costtrackingp erinteractionisoptionalbutencouraged.

## Part4: Testing&Quality(20%)

4.1BackendTestingUnittestsforcorelogic(auth,p ermissions,prompts)withpytest.APIintegration
testsusingTestClientcoveringauth,do cumentCRUDwithp ermissions,andAIinvo cation(mo cktheLLM).
WebSo ckettestsforconnectionauthandbasicmessageexchange.

4.2FrontendTestingComp onenttests(ReactTestingLibrary,Vitest,orJest)forauthow,do cument
UI,andAIsuggestionUI.E2Etests(Playwright,Cypress)areoptionalbutencouraged.

4.3Setup&Do cumentationIncludearunscript(e.g.,run.shorMakefile)thatstartsthebackendand
frontendlo callywithasinglecommand.Includean.env.example.Nodeploymentisrequired.Comprehensive
README(setup,running,tests,architectureoverview). FastAPIauto-generatedAPIdo cswithmeaningful
descriptionsandschemas. Do cumentalldeviationsfromAssignment 1 architecturewhatchanged,why,and
whetheritwasanimprovementorcompromise.

## Part5: Demo&Presentation(10%)

Livedemo(5minmax)showing,insequence:(1)registrationandloginwithprotectedroutes,(2)do cument
creationwithrich-texteditingandauto-save,(3)sharingwithroleenforcement,(4)real-timecollab orationin
twobrowserwindows,(5)AIassistantwithstreaming(twofeatures,suggestionUX,cancellation),(6)version
historyrestore.

Thedemomustusetheactualrunningapplication.Ifsomethingbreaks,explainwhatwentwrong.

TechnicalQ&A(5min): evaluatorsmayaskab outJWTrefresh,theend-to-endAIow,concurrentedit
handling,LLMfailurescenarios,testcoverage,anddeviationsfromAssignment1. Eachteammemb ermust
b eabletoanswerindepthab outthepartstheyp ersonallyimplemented.Allteammemb ersshouldb eableto
answergeneralquestionsab outtheoverallarchitectureanddesigndecisions.


## SubmissionFormat

Sourceco de:Gitrep ositorylink;mainbranch=nalversion.Do cumentation:README,architecturede-
viations,APIdo csallintherep o.Architecturedeviationrep ort:AdedicatedsectioninyourREADME
(oraseparateDEVIATIONS.mdle)do cumentingeverydierenceb etweenyourAssignment 1 designandyour
nalimplementation.Foreachdeviation,explain:whatchanged,why,andwhetherthechangewasanimprove-
mentoracompromise.Thisisnotap enaltydesignsalwaysevolve.Thep enaltyisfordeviatingsilently.Run
script:Includeascript(e.g.,run.shorMakefile)thatstartsb oththebackendandfrontendlo callywitha
singlecommand.Nodeploymentisrequired.Setup:Includean.env.examplewithallrequiredenvironment
variablesdo cumented.Areviewershouldb eabletoclone,congurethe.env,andrunyourscripttohavethe
applicationworkinglo cally.Demo:Live,inp erson.Backuprecordingoptional.

## GradingRubric

Eachcomp onentisgradedonafour-tierscale;theoverallscoreistheweightedsumplusanyb onus. Total:
100 base+ 10 b onus=110/100max.

Comp onent Wt. Outstanding(90100) Excellent(7589) Adequate(5074) Insu.(<50)

CoreApp 25% Baseline + most A
features. Secure JWT
lifecycle. Polished rich-
text,auto-save,versioning.
Server-side p ermissions
audited.

```
Baseline+someA1fea-
tures. JWTend-to-end.
Do cument CRUD solid.
Permissions enforced
server-side. Minorrough
edges.
```
```
Baselinepresentbutrough.
Refreshaky. Versioning
incomplete. Permissions
partiallyfrontend-only.
```
```
Authbrokenorplaintext.
Missing do cumentmgmt.
Nop ermissions.
```
Real-TimeCollab 20% Reliable concurrent edit-
ing+A1collabfeatures.
Cleanlifecycle, reconnec-
tion, state reconciliation.
Presencep olished.

```
Baseline works reliably.
Some A1collabfeatures.
Reconnectionhandled.
```
```
Basicsyncwitho ccasional
datalossormanualrefresh.
Minimalpresence.
```
```
Real-timebrokenorover-
writes.Nouserawareness.
```
AIAssistant 25% Baseline+A1AIfeatures.
Clean streaming (cancel,
partials). Strong sug-
gestion UX.Congurable
prompts,providerabstrac-
tion,history.

```
≥ 2 features + some A
AI. Streaming works.
Accept/reject/undo func-
tional. Prompts cong-
urable.
```
```
≥ 2 featureswithstream-
ing. Minimal compari-
sonUX.Promptspartially
hardco ded.
```
```
< 2 featuresornostream-
ing. Fire-and-forget re-
placement.
```
Testing&Quality 20% Meaningful backend +
frontendtests with go o d
coverage. Clean single-
command setup. Clear
README, API do cs,
deviationrep ort.

```
Solidbackendtests,some
frontend. Setup works
from cleanclone. Do cs
coveressentialsincl.devi-
ations.
```
```
Thin coverage. Setup
needsmanualintervention.
Incompletedo csordevia-
tionrep ort.
```
```
Notests. Extensiveman-
ualsetup.Nodo cs.
```
Demo 10% All scenarios shown live
smo othly. Memb ers ex-
plainownworkindepth;
all handle architecture
Q&A.

```
All scenarios shown live.
Own-work answers con-
dent.Minorgapsonarchi-
tecture.
```
```
Mostscenariosshown.Vis-
iblestruggleonQ&Aor
unclearownership.
```
```
Slides/videoinsteadoflive
app.Cannotexplaindeci-
sions.
```
Bonus(upto+10pts,max110/100).Eachitemb elowisworthupto 2 p ointswhenimplementedwell:

```
Character-levelconictresolutionviaCRDTs(e.g.,Yjs)orOT,withnodatalossunderadversarial
conditions.
Remotecursorandselectiontrackingrenderedinrealtimewithdistinctcolors/lab els.
Share-by-linkwithcongurablep ermissionsandrevo cation.
PartialacceptanceofAIsuggestions(accept/rejectindividualparts).
End-to-endtests(Playwright/Cypress)coveringloginthroughAIsuggestionacceptance.
```
## Imp ortantNotes

```
YourAssignment 1 designisyourstartingp oint,notaprison.Do cumentwhatchangedandwhy.
Streamingisnon-negotiable.Ablo ckingAIcallwithaloadingspinnerisnotacceptable.
Securityisnotoptional. Hashedpasswords,expiringtokens,server-sidep ermissions,nosecretsinthe
rep o.
Thecollab orationlayerishard.Getbasicreal-timesyncworkingearlyandbuildontopofit.
Co dequalitymatters.Consistentformatting,clearmo duleb oundaries,navigablepro jectstructure.
Githistoryispartofthedeliverable. Meaningfulcommits,featurebranches,PRswithreviews. A
singlenalcommitisaredag.
Everyteammemb ermustcontributeco de.WecheckGitattribution.Nocommits=individualgrade
adjustment.
```

